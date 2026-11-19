#!/usr/bin/env bash
# Builds the app the suite runs against: the current Laravel release, made with
# the official installer (`laravel new`) and an official starter kit, in a DDEV
# project, the way the DDEV quickstart for Laravel does it.
#
# Settings (environment variables, all optional):
#   PROJECT_NAME     the DDEV project name                (default laravelsteps)
#   SITE_DIR         the project folder                   (default a new temporary folder)
#   STARTER_KIT      livewire, react or vue               (default livewire)
#   MEMBER_PASSWORD  the password of the accounts below   (default Member-Pass-2026!)
#   ACCOUNTS_ONLY    1: build nothing, give the accounts of the app in SITE_DIR
#                    back their name, password and state (after a run that was
#                    stopped half way)
#
# The accounts are configuration: this script creates them and cucumber.js names
# them; the features never create or delete users.
#   member      Mia Member, member@example.com          a verified account
#   unverified  Uma Unverified, unverified@example.com  an account whose address is not verified yet
#
# Nothing is installed that the starter kit does not bring: no paid package, no
# trial, no sign-in to any service.
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-laravelsteps}"
STARTER_KIT="${STARTER_KIT:-livewire}"
MEMBER_PASSWORD="${MEMBER_PASSWORD:-Member-Pass-2026!}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"

case "$STARTER_KIT" in
  livewire|react|vue) ;;
  *) echo "STARTER_KIT must be livewire, react or vue, not \"$STARTER_KIT\"." >&2; exit 1 ;;
esac

# The accounts (see the header), written by the app itself, so the password is
# hashed the way the app hashes it. Run again, it gives them back their name,
# their password and their state.
write_accounts() {
  python3 -c '
import json, sys
password = sys.argv[1]
print(json.dumps([
    {"name": "Mia Member", "email": "member@example.com", "password": password, "verified": True},
    {"name": "Uma Unverified", "email": "unverified@example.com", "password": password, "verified": False},
]))' "$MEMBER_PASSWORD" > accounts.json
  cp "$REPO_DIR/site/accounts.php" accounts.php
  ddev exec php accounts.php accounts.json
  rm -f accounts.php accounts.json
}

mkdir -p "$SITE_DIR"
cd "$SITE_DIR"

if [ "${ACCOUNTS_ONLY:-}" = "1" ]; then
  write_accounts
  exit 0
fi

# Node.js 24, the line the starter kits build their assets with.
ddev config --project-type=laravel --docroot=public --project-name="$PROJECT_NAME" --nodejs-version=24

# The official installer, in the web container only for the time of the build.
mkdir -p .ddev/web-build
cat > .ddev/web-build/Dockerfile.laravel-installer <<'DOCKERFILEEND'
ARG COMPOSER_HOME=/usr/local/composer
RUN composer global require laravel/installer
RUN ln -s $COMPOSER_HOME/vendor/bin/laravel /usr/local/bin/laravel
DOCKERFILEEND
ddev start -y

ddev exec laravel new temp --"$STARTER_KIT" --database=sqlite --pest --npm --no-boost --no-interaction
ddev exec 'rsync -rltgopD temp/ ./ && rm -rf temp'
rm -f .ddev/web-build/Dockerfile.laravel-installer .env
ddev restart
ddev composer run-script post-root-package-install
ddev composer run-script post-create-project-cmd

# The one page the test app adds to a new app: an error nothing catches, which
# the server error page scenarios open. Everything else is the starter kit's.
cat >> routes/web.php <<'PHPEOF'

// Added by the test app of the webship-js suite: an error nothing catches.
Route::get('test-fixtures/server-error', function () {
    throw new RuntimeException('The test app raised this error on purpose.');
});
PHPEOF

write_accounts

# A test app behaves like a live one: an error renders the error page, never
# the debug page, and the password rules are the ones a live app applies.
ddev dotenv set .env --app-env=production --app-debug=false

SITE_URL="$(ddev describe -j | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['primary_url'])")"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
FRAMEWORK="$(ddev artisan --version 2>/dev/null || true)"
echo "Built ${FRAMEWORK:-(unknown version)} with the ${STARTER_KIT} starter kit at $SITE_URL"
