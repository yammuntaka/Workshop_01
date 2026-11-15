namespace Vista.Server.Application
{
    internal sealed class CurrentUser
    {
        public CurrentUser(string displayName, string role)
        {
            DisplayName = displayName;
            Role = role;
        }

        public string DisplayName { get; private set; }

        public string Role { get; private set; }
    }
}
