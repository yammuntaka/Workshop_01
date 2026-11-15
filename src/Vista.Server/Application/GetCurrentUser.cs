using System.Security.Principal;

namespace Vista.Server.Application
{
    internal sealed class GetCurrentUser
    {
        public CurrentUser Execute(IIdentity identity)
        {
            if (identity == null || !identity.IsAuthenticated || string.IsNullOrEmpty(identity.Name))
            {
                return null;
            }

            return new CurrentUser(identity.Name, "บัญชี Windows");
        }
    }
}
