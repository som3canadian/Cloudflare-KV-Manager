import requests
import base64
import json
from datetime import datetime

### CONFIGURATION ###
this_kv_worker_url = "<your-worker-url>"
this_kv_worker_secret = "<your-secret>"
this_kv_worker_custom_header = "<your-custom-header>"
MIDDLEWARE_USE_ZERO_TRUST = False
MIDDLEWARE_SERVICE_AUTH_CLIENT_ID = "<your-service-auth-client-id>"
MIDDLEWARE_SERVICE_AUTH_CLIENT_SECRET = "<your-service-auth-client-secret>"

default_expiration_days = 0
default_metadata = {
    "timestamp": datetime.now().isoformat()
}
### CONFIGURATION ###

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
    response = request_builder(endpoint, this_kv_worker_secret)
    return response['data']['namespaces']

def list_kv_keys(namespace):
    endpoint = f"/list?limit=500&namespace={namespace}"
    response = request_builder(endpoint, this_kv_worker_secret)
    return response['data']['keys']

def get_key(key, namespace):
    endpoint = f"/get?key={key}&namespace={namespace}"
    response = request_builder(endpoint, this_kv_worker_secret)
    return response['data']

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

def set_key_value(key, value, metadata=default_metadata, namespace=None, expiration=default_expiration_days):
    base64_metadata = b64_encode_json(metadata)
    endpoint = f"/set?key={key}&value={value}&expiration={expiration}&metadata={base64_metadata}&namespace={namespace}"
    return request_builder(endpoint, this_kv_worker_secret)

def delete_key(key, namespace):
    endpoint = f"/delete?key={key}&namespace={namespace}"
    return request_builder(endpoint, this_kv_worker_secret)

def delete_all_keys(namespace):
    endpoint = f"/delete_all?namespace={namespace}"
    return request_builder(endpoint, this_kv_worker_secret)

# Check if at least one namespace exists
def at_least_one_namespace_exists():
    endpoint = f"/namespaces"
    response = request_builder(endpoint, this_kv_worker_secret)
    response_length = len(response['data']['namespaces'])
    if response_length == 0:
        return False
    else:
        return True

if at_least_one_namespace_exists() is False:
    print("No namespaces found")
    exit(1)
