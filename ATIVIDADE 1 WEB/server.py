from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


ANEEL_API = 'https://dadosabertos.aneel.gov.br/api/3/action/datastore_search'


class SiteHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        request = urlsplit(self.path)

        if request.path == '/api/aneel':
            self.proxy_aneel(request.query)
            return

        super().do_GET()

    def proxy_aneel(self, query):
        try:
            request = Request(f'{ANEEL_API}?{query}', headers={'User-Agent': 'Calculadora-ODS7'})
            with urlopen(request, timeout=20) as response:
                content = response.read()
                self.send_response(response.status)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
        except Exception as error:
            message = f'{{"error": "{error}"}}'.encode('utf-8')
            self.send_response(502)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(message)))
            self.end_headers()
            self.wfile.write(message)


server = ThreadingHTTPServer(('localhost', 8000), SiteHandler)
print('Site disponível em http://localhost:8000/index.HTML')
server.serve_forever()