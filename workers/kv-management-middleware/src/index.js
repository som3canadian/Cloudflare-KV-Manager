addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

function getTimestamp() {
	return new Date().toISOString();
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

	if (pathname === '/namespaces') {
		const namespaces = Object.keys(self)
			.filter(key => typeof self[key] === 'object' && self[key]?.list instanceof Function)

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
    if (providedExpiration !== null) {
        expiration = parseInt(providedExpiration) || 0
    }
		// convert days to seconds
		expiration = expiration * 24 * 60 * 60
		const b64encoded_metadata = url.searchParams.get('metadata')
		const temp_metadata = b64encoded_metadata && atob(b64encoded_metadata)
		const metadata = temp_metadata && JSON.parse(temp_metadata)

		if (key && value) {
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
		// loop through all keys in the namespace and delete them
		const listResult = await MY_KV_NAMESPACE.list()
		for (const key of listResult.keys) {
			await MY_KV_NAMESPACE.delete(key.name)
		}
		const response = {
			status: 'success',
			message: `All keys deleted in namespace ${namespace}`,
			data: { 'message': 'All keys deleted in namespace ' + namespace },
			timestamp: getTimestamp(),
		}
		return new Response(JSON.stringify(response), {
			status: 200,
			headers: headers,
		})
	} else if (pathname === '/get') {
		if (key) {
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
		const limit = parseInt(url.searchParams.get('limit')) || 100
		const cursor = url.searchParams.get('cursor')

		try {
			const listOptions = {
				limit: Math.min(limit, 1000)
			}
			if (cursor) {
				listOptions.cursor = cursor
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
