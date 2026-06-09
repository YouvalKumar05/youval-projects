import requests
import json
response = requests.get('http://127.0.0.1:8000/api/executions')
print(json.dumps(response.json()['data'][:5], indent=2))
