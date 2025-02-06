import requests
import base64
import json

this_kv_worker_url = "<your-worker-url>"
this_kv_worker_secret = "<your-secret>"
this_kv_worker_custom_header = "<your-custom-header>"
MIDDLEWARE_USE_ZERO_TRUST = False
MIDDLEWARE_SERVICE_AUTH_CLIENT_ID = "<your-service-auth-client-id>"
MIDDLEWARE_SERVICE_AUTH_CLIENT_SECRET = "<your-service-auth-client-secret>"

# get base64 of the data
def b64_encode_json(data: str) -> str:
    """Return the base64 for json data."""
    return base64.b64encode(json.dumps(data).encode()).decode()

def request_builder(endpoint, secret):
    url = f"{this_kv_worker_url}{endpoint}"
    if MIDDLEWARE_USE_ZERO_TRUST is True:
        headers = {
            this_kv_worker_custom_header: secret,
            'Cf-Access-Client-Id': MIDDLEWARE_SERVICE_AUTH_CLIENT_ID,
            'Cf-Access-Client-Secret': MIDDLEWARE_SERVICE_AUTH_CLIENT_SECRET,
            'Content-Type': 'application/json'
        }
    else:
        headers = {
            this_kv_worker_custom_header: secret,
            'Content-Type': 'application/json'
        }
    response = requests.get(url, headers=headers)
    response_json = response.json()
    return response_json

def list_namespaces():
    endpoint = f"/namespaces"
    return request_builder(endpoint, this_kv_worker_secret)

def list_kv_keys(namespace):
    endpoint = f"/list?limit=500&namespace={namespace}"
    return request_builder(endpoint, this_kv_worker_secret)

def get_key(key, namespace):
    endpoint = f"/get?key={key}&namespace={namespace}"
    return request_builder(endpoint, this_kv_worker_secret)

def get_key_value(key, namespace):
    endpoint = f"/get?key={key}&namespace={namespace}"
    response = request_builder(endpoint, this_kv_worker_secret)
    value = response['data']['value']['value']
    return value

def get_key_metadata(key, namespace):
    endpoint = f"/get?key={key}&namespace={namespace}"
    complete_response = request_builder(endpoint, this_kv_worker_secret)
    metadata = complete_response['data']['value']['metadata']
    return metadata

def set_key_value(key, value, metadata={}, namespace=None, expiration=None):
    base64_metadata = b64_encode_json(metadata)
    endpoint = f"/set?key={key}&value={value}&expiration={expiration}&metadata={base64_metadata}&namespace={namespace}"
    return request_builder(endpoint, this_kv_worker_secret)

def delete_key(key, namespace):
    endpoint = f"/delete?key={key}&namespace={namespace}"
    return request_builder(endpoint, this_kv_worker_secret)

def delete_all_keys(namespace):
    endpoint = f"/delete_all?namespace={namespace}"
    return request_builder(endpoint, this_kv_worker_secret)
