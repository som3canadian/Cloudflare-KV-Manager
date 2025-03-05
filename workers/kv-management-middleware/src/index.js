addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

function getTimestamp() {
	return new Date().toISOString();
}

// Function to check if a key is protected from modification or deletion
function isProtectedKey(key) {
	const protectedKeys = ['random_content', 'mykey', 'random_content_two'];
	return protectedKeys.includes(key);
}

async function handleRequest(request) {
	// Helper function for consistent headers
	const headers = {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': '*'
	}

	// Handle CORS preflight requests
	if (request.method === 'OPTIONS') {
		return new Response(null, {
			headers: headers,
			status: 204
		})
	}

	// Deny non-GET requests
	if (request.method !== 'GET') {
		const errorResponse = {
			status: 'error',
			message: 'Only GET requests are allowed',
			timestamp: getTimestamp(),
		}
		return new Response(JSON.stringify(errorResponse), {
			status: 405,
			headers: headers,
		})
	}

	// Authentication check
	const isAuthenticated = checkAuthentication(request)
	if (!isAuthenticated) {
		const errorResponse = {
			status: 'error',
			message: 'Unauthorized access',
			timestamp: getTimestamp(),
		}
		return new Response(JSON.stringify(errorResponse), {
			status: 401,
			headers: headers,
		})
	}

	const url = new URL(request.url)
	const pathname = url.pathname
	const key = url.searchParams.get('key')
	const namespace = url.searchParams.get('namespace')
	const ip = request.headers.get('cf-connecting-ip')
	const cooling_period = 10 * 60 // 10 minutes
	const timestamp = getTimestamp()

	// Use Cloudflare's native Rate Limiting API
	const rateLimiterKey = buildRateLimiterKey(pathname, ip)
	// console.log('rateLimiterKey', rateLimiterKey)

	// Check if the request is rate limited
	// const { success } = await KV_RATE_LIMITER.limit({ key: ip })
	let success;
	if (pathname === '/list') {
		success = await KV_LIST_RATE_LIMITER.limit({ key: rateLimiterKey })
	}
	if (pathname !== '/list') {
		success = await KV_RATE_LIMITER.limit({ key: rateLimiterKey })
	}

	if (!success) {
		await rate_limiting_kv.put(ip, "blocked", {
			expirationTtl: cooling_period,
			metadata: {
				timestamp: timestamp
			}
		});
		return new Response('Rate limit exceeded', { status: 429 })
	}

	// check if ip is blocked
	const blocked = await rate_limiting_kv.get(ip)
	if (blocked) {
		return new Response('Rate limit exceeded, wait a few minutes before trying again', { status: 429 })
	}

	const hiddenNamespaces = HIDDEN_NAMESPACES
	if (pathname === '/namespaces') {
		const namespaces = Object.keys(self)
			.filter(key => typeof self[key] === 'object' && self[key]?.list instanceof Function)
			.filter(key => !hiddenNamespaces.includes(key))

		const response = {
			status: 'success',
			data: {
				namespaces: namespaces
			},
			timestamp: getTimestamp(),
		}
		return new Response(JSON.stringify(response), {
			status: 200,
			headers: headers,
		})
	}

	// Move namespace check here, after the /namespaces endpoint
	if (!namespace) {
		const errorResponse = {
			status: 'error',
			message: 'Invalid namespace',
			timestamp: getTimestamp(),
		}
		return new Response(JSON.stringify(errorResponse), {
			status: 400,
			headers: headers,
		})
	}
	const MY_KV_NAMESPACE = self[namespace]
	if (!MY_KV_NAMESPACE) {
		const errorResponse = {
			status: 'error',
			message: 'Namespace not found',
			timestamp: getTimestamp(),
		}
		return new Response(JSON.stringify(errorResponse), {
			status: 400,
			headers: headers,
		})
	}

	if (pathname === '/set') {
		const value = url.searchParams.get('value')
		const providedExpiration = url.searchParams.get('expiration')
		let expiration = DEFAULT_EXPIRATION_DAYS
		// Turnstile verification
		const token = request.headers.get('cf-turnstile-response')
		const turnstileResult = await verifyTurnstile(token, request)

		if (!turnstileResult.success) {
			const errorResponse = {
				status: 'error',
				message: 'Turnstile verification failed',
				error: turnstileResult.error || 'Unknown error',
				timestamp: getTimestamp(),
			}
			return new Response(JSON.stringify(errorResponse), {
				status: 403,
				headers: headers,
			})
		}
		// End of Turnstile verification, continue with the request
    if (providedExpiration !== null) {
        expiration = parseInt(providedExpiration) || 0
    }
		// convert days to seconds
		// expiration = expiration * 24 * 60 * 60
		// hardcoded expiration for demo purposes (30 minutes)
		expiration = 30 * 60
		const b64encoded_metadata = url.searchParams.get('metadata')
		const temp_metadata = b64encoded_metadata && atob(b64encoded_metadata)
		const metadata = temp_metadata && JSON.parse(temp_metadata)

		if (key && value) {
			// Check if key is protected
			if (isProtectedKey(key)) {
				const errorResponse = {
					status: 'success',
					message: `The key "${key}" is protected and cannot be modified`,
					data: {
						key,
						protected: true
					},
					timestamp: getTimestamp(),
				}
				return new Response(JSON.stringify(errorResponse), {
					status: 200,
					headers: headers,
				})
			}

			// Check if key already exists
			const existingValue = await MY_KV_NAMESPACE.getWithMetadata(key)

			// Start with a clean metadata object or use the provided metadata
			let fullMetadata = metadata ? { ...metadata } : {}

			// Always set the timestamp
			fullMetadata.timestamp = getTimestamp()

			// Set creation_timestamp only for new keys, or preserve it for existing keys
			if (!existingValue || !existingValue.value) {
				fullMetadata.creation_timestamp = getTimestamp()
			} else if (existingValue.metadata?.creation_timestamp) {
				fullMetadata.creation_timestamp = existingValue.metadata.creation_timestamp
			}

			const putOptions = {
				metadata: fullMetadata
			}
			if (expiration > 0) {
				putOptions.expirationTtl = expiration
			}

			// Set the key
			await MY_KV_NAMESPACE.put(key, value, putOptions)

			// Get the key back to verify and return complete data
			const { value: storedValue, metadata: storedMetadata } = await MY_KV_NAMESPACE.getWithMetadata(key)

			const response = {
				status: 'success',
				message: `Set ${key} successfully`,
				data: {
					key,
					value: storedValue,
					metadata: storedMetadata,
					expiration: expiration === 0 ? null : Math.floor(Date.now() / 1000) + expiration
				},
				timestamp: getTimestamp(),
			}

			return new Response(JSON.stringify(response), {
				status: 200,
				headers: headers,
			})
		} else {
			const errorResponse = {
				status: 'error',
				message: 'Missing key or value',
				timestamp: getTimestamp(),
			}
			return new Response(JSON.stringify(errorResponse), {
				status: 400,
				headers: headers,
			})
		}
	} else if (pathname === '/delete') {
		if (key) {
			// check if namespace is hidden
			if (hiddenNamespaces.includes(namespace)) {
				const errorResponse = {
					status: 'error',
					message: 'Namespace not found',
					timestamp: getTimestamp(),
				}
				return new Response(JSON.stringify(errorResponse), {
					status: 404,
					headers: headers,
				})
			}
			// Check if key is protected
			if (isProtectedKey(key)) {
				const errorResponse = {
					status: 'success',
					message: `The key "${key}" is protected and cannot be modified`,
					data: {
						key,
						protected: true
					},
					timestamp: getTimestamp(),
				}
				return new Response(JSON.stringify(errorResponse), {
					status: 200,
					headers: headers,
				})
			}

			await MY_KV_NAMESPACE.delete(key)
			const response = {
				status: 'success',
				message: `Deleted key ${key}`,
				data: { key },
				timestamp: getTimestamp(),
			}
			return new Response(JSON.stringify(response), {
				status: 200,
				headers: headers,
			})
		} else {
			const errorResponse = {
				status: 'error',
				message: 'Missing key',
				timestamp: getTimestamp(),
			}
			return new Response(JSON.stringify(errorResponse), {
				status: 400,
				headers: headers,
			})
		}
	} else if (pathname === '/delete_all') {
		// check if namespace is hidden
		if (hiddenNamespaces.includes(namespace)) {
			const errorResponse = {
				status: 'error',
				message: 'Namespace not found',
				timestamp: getTimestamp(),
			}
			return new Response(JSON.stringify(errorResponse), {
				status: 404,
				headers: headers,
			})
		}
		// loop through all keys in the namespace and delete them
		const listResult = await MY_KV_NAMESPACE.list()
		for (const key of listResult.keys) {
			// Skip protected keys during delete_all operation
			if (!isProtectedKey(key.name)) {
				await MY_KV_NAMESPACE.delete(key.name)
			}
		}
		const response = {
			status: 'success',
			message: `All non-protected keys deleted in namespace ${namespace}`,
			data: { 'message': 'All non-protected keys deleted in namespace ' + namespace },
			timestamp: getTimestamp(),
		}
		return new Response(JSON.stringify(response), {
			status: 200,
			headers: headers,
		})
	} else if (pathname === '/get') {
		if (key) {
			// check if namespace is hidden
			if (hiddenNamespaces.includes(namespace)) {
				const errorResponse = {
					status: 'error',
					message: 'Namespace not found',
					timestamp: getTimestamp(),
				}
				return new Response(JSON.stringify(errorResponse), {
					status: 404,
					headers: headers,
				})
			}
			const value = await MY_KV_NAMESPACE.getWithMetadata(key)
			if (value !== null) {
				const response = {
					status: 'success',
					data: { key, value },
					timestamp: getTimestamp(),
				}
				return new Response(JSON.stringify(response), {
					status: 200,
					headers: headers,
				})
			} else {
				const errorResponse = {
					status: 'error',
					message: `Key ${key} not found`,
					timestamp: getTimestamp(),
				}
				return new Response(JSON.stringify(errorResponse), {
					status: 404,
					headers: headers,
				})
			}
		} else {
			const errorResponse = {
				status: 'error',
				message: 'Missing key',
				timestamp: getTimestamp(),
			}
			return new Response(JSON.stringify(errorResponse), {
				status: 400,
				headers: headers,
			})
		}
	} else if (pathname === '/list') {
		const limit = parseInt(url.searchParams.get('limit')) || 1000
		const cursor = url.searchParams.get('cursor') || undefined

		try {
			const listOptions = { limit }
			if (cursor) {
				listOptions.cursor = cursor
			}
			// check if namespace is hidden
			if (hiddenNamespaces.includes(namespace)) {
				const errorResponse = {
					status: 'error',
					message: 'Namespace not found',
					timestamp: getTimestamp(),
				}
				return new Response(JSON.stringify(errorResponse), {
					status: 404,
					headers: headers,
				})
			}
			const listResult = await MY_KV_NAMESPACE.list(listOptions)

			// Fetch values and metadata for all keys
			const keysWithValues = await Promise.all(
				listResult.keys.map(async (key) => {
					const { value, metadata } = await MY_KV_NAMESPACE.getWithMetadata(key.name)
					return {
						...key,
						value,
						metadata
					}
				})
			)

			const response = {
				status: 'success',
				data: {
					keys: keysWithValues,
					list_complete: listResult.list_complete,
					cursor: listResult.cursor,
				},
				timestamp: getTimestamp(),
			}
			return new Response(JSON.stringify(response), {
				status: 200,
				headers: headers,
			})
		} catch (error) {
			const errorResponse = {
				status: 'error',
				message: error.toString(),
				timestamp: getTimestamp(),
			}
			return new Response(JSON.stringify(errorResponse), {
				status: 500,
				headers: headers,
			})
		}
	} else {
		const errorResponse = {
			status: 'error',
			message: 'Invalid path',
			timestamp: getTimestamp(),
		}
		return new Response(JSON.stringify(errorResponse), {
			status: 404,
			headers: headers,
		})
	}
}

// Authentication function
function checkAuthentication(request) {
	const authHeader = request.headers.get(CUSTOM_HEADER)
	if (authHeader && authHeader === WORKER_KV_SECRET) {
		return true
	} else {
		return false
	}
}

function getTimestamp() {
	return new Date().toISOString();
}

// build rate limiter key
function buildRateLimiterKey(action, ip) {
	return `${action.replace(/[^a-zA-Z0-9_-]/g, '_')}:${ip}`
}

// Turnstile verification
async function verifyTurnstile(token, request) {
	// If no token is provided, verification fails
	if (!token) {
		console.error('Turnstile token is missing');
		return {
			success: false,
			error: 'Missing token'
		};
	}

	try {
		// Get the client IP address from the request
		const clientIP = request.headers.get('cf-connecting-ip') || '';

		// Create the form data as URLSearchParams
		const formData = new URLSearchParams();
		formData.append('secret', TURNSTILE_SECRET_KEY);
		formData.append('response', token);
		formData.append('remoteip', clientIP);

		// Make the verification request to Cloudflare
		const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: formData
		});

		// Parse the response
		const outcome = await response.json();

		if (outcome.success) {
			// Check if the challenge was solved recently
			const challengeTs = new Date(outcome.challenge_ts).getTime();
			const now = Date.now();
			const fiveMinutesAgo = now - 5 * 60 * 1000;

			if (challengeTs < fiveMinutesAgo) {
				console.error('Turnstile challenge is too old');
				return {
					success: false,
					error: 'Challenge expired'
				};
			}

			return {
				success: true
			};
		} else {
			// Log the error codes for debugging
			let errorMessage = 'Verification failed';
			if (outcome['error-codes'] && outcome['error-codes'].length > 0) {
				console.error('Turnstile error codes:', outcome['error-codes']);
				errorMessage = outcome['error-codes'].join(', ');
			}
			return {
				success: false,
				error: errorMessage
			};
		}
	} catch (error) {
		console.error('Turnstile verification error:', error);
		return {
			success: false,
			error: error.message || 'Internal error'
		};
	}
}
