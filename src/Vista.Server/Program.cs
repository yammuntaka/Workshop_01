using System;
using System.IO;
using System.Net;
using Vista.Server.Application;
using Vista.Server.Infrastructure.Http;

namespace Vista.Server
{
    internal static class Program
    {
        private static void Main(string[] args)
        {
            if (args.Length != 1)
            {
                Console.Error.WriteLine("Usage: VistaServer.exe <website-folder>");
                Environment.ExitCode = 1;
                return;
            }

            string webRoot = Path.GetFullPath(args[0]);
            if (!File.Exists(Path.Combine(webRoot, "index.html")))
            {
                Console.Error.WriteLine("index.html was not found: " + webRoot);
                Environment.ExitCode = 1;
                return;
            }

            var handler = new DashboardRequestHandler(webRoot, new GetCurrentUser());
            using (var listener = new HttpListener())
            {
                listener.AuthenticationSchemes = AuthenticationSchemes.IntegratedWindowsAuthentication;
                listener.Prefixes.Add("http://localhost:8000/");
                listener.Prefixes.Add("http://127.0.0.1:8000/");
                listener.Start();
                Console.WriteLine("Vista is running at http://localhost:8000/");
                Console.WriteLine("Windows Integrated Authentication is enabled. Press Ctrl+C to stop.");

                while (listener.IsListening)
                {
                    handler.Handle(listener.GetContext());
                }
            }
        }
    }
}
