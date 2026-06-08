{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [ pkgs.nodejs_20 ];
  idx.previews.enable = true;
  idx.previews.previews.web.command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
  idx.previews.previews.web.manager = "web";
}
