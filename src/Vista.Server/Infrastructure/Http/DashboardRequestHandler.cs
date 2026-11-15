using System.IO;
using System.Net;
using System.Security.Principal;
using System.Text;
using Vista.Server.Application;

namespace Vista.Server.Infrastructure.Http
{
    internal sealed class DashboardRequestHandler
    {
        private readonly string _webRoot;
        private readonly GetCurrentUser _getCurrentUser;

        public DashboardRequestHandler(string webRoot, GetCurrentUser getCurrentUser)
        {
            _webRoot = webRoot;
            _getCurrentUser = getCurrentUser;
        }

        public void Handle(HttpListenerContext context)
        {
            string path = context.Request.Url.AbsolutePath;

            if (path == "/api/user")
            {
                IIdentity identity = context.User == null ? null : context.User.Identity;
                CurrentUser user = _getCurrentUser.Execute(identity);
                if (user == null)
                {
                    WriteResponse(context.Response, 401, "application/json; charset=utf-8",
                        Encoding.UTF8.GetBytes("{\"error\":\"Windows authentication required\"}"));
                    return;
                }

                string json = "{\"displayName\":\"" + EscapeJson(user.DisplayName) +
                    "\",\"role\":\"" + EscapeJson(user.Role) + "\"}";
                WriteResponse(context.Response, 200, "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                return;
            }

            if (path == "/" || path == "/index.html")
            {
                ServeFile(context.Response, "index.html", "text/html; charset=utf-8");
                return;
            }

            if (path == "/css/dashboard.css")
            {
                ServeFile(context.Response, Path.Combine("css", "dashboard.css"), "text/css; charset=utf-8");
                return;
            }

            if (path == "/js/dashboard.js")
            {
                ServeFile(context.Response, Path.Combine("js", "dashboard.js"), "application/javascript; charset=utf-8");
                return;
            }

            if (path == "/js/data-service.js")
            {
                ServeFile(context.Response, Path.Combine("js", "data-service.js"), "application/javascript; charset=utf-8");
                return;
            }

            if (path == "/data/products.json")
            {
                ServeFile(context.Response, Path.Combine("data", "products.json"), "application/json; charset=utf-8");
                return;
            }

            WriteResponse(context.Response, 404, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Not Found"));
        }

        private void ServeFile(HttpListenerResponse response, string relativePath, string contentType)
        {
            string filePath = Path.Combine(_webRoot, relativePath);
            if (!File.Exists(filePath))
            {
                WriteResponse(response, 404, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Not Found"));
                return;
            }

            WriteResponse(response, 200, contentType, File.ReadAllBytes(filePath));
        }

        private void WriteResponse(HttpListenerResponse response, int statusCode, string contentType, byte[] body)
        {
            response.StatusCode = statusCode;
            response.ContentType = contentType;
            response.ContentLength64 = body.Length;
            response.Headers.Add("Cache-Control", "no-store");
            response.OutputStream.Write(body, 0, body.Length);
            response.Close();
        }

        private string EscapeJson(string value)
        {
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"")
                .Replace("\r", "\\r").Replace("\n", "\\n").Replace("\t", "\\t");
        }
    }
}
