import urllib.request
import urllib.parse
import json

boundary = """POINTID,Z,X,Y\n1,10.0,108.613867,11.669531\n2,10.0,108.613828,11.669526\n3,10.0,108.613776,11.669516\n"""
pole = """POINTID,Z,X,Y\n1,10.0,108.613867,11.669531\n2,10.0,108.613828,11.669526\n3,10.0,108.613776,11.669516\n4,10.0,108.60,11.60\n"""

# Multipart form-data parser without requests
import mimetypes

def encode_multipart_formdata(fields):
    boundary = '---011000010111000001101001'
    buf = []
    
    for (key, filename, value) in fields:
        buf.append(f'--{boundary}')
        buf.append(f'Content-Disposition: form-data; name="{key}"; filename="{filename}"')
        buf.append('Content-Type: text/csv')
        buf.append('')
        buf.append(value)
    
    buf.append(f'--{boundary}--')
    buf.append('')
    body = '\r\n'.join(buf).encode('utf-8')
    content_type = f'multipart/form-data; boundary={boundary}'
    return content_type, body

fields = [
    ('vach_file', 'vach.csv', boundary),
    ('tru_file', 'tru.csv', pole)
]

content_type, body = encode_multipart_formdata(fields)

req = urllib.request.Request("http://localhost:8000/upload-survey", data=body, headers={'Content-Type': content_type})

try:
    with urllib.request.urlopen(req) as response:
        html = response.read()
        data = json.loads(html)
        print("Keys:", data.keys())
        print("Boundary preview:", data['boundary_points'][:2] if 'boundary_points' in data else 'N/A')
except Exception as e:
    print("Error:", str(e))
