{
  pkgs,
  ...
}:

{
  env.GREET = "devenv";


  services.postgres = {
    enable = true;
    initialScript = "CREATE USER test SUPERUSER;";
    listen_addresses = "127.0.0.1";
    package = pkgs.postgresql_18;
    initialDatabases = [
      {
        name = "subrent";
      }
    ];
    settings = {
      log_connections = true;
      log_statement = "all";
    };
  };
}
