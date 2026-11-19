<?php

// Creates the accounts the suite logs in as, or gives them back their name,
// password and state: the build script runs it once, in the app's folder.
// Accounts are configuration: cucumber.js names them, a feature never creates
// or deletes one.
//
//   php accounts.php accounts.json
//
// accounts.json: [{"name": "Mia Member", "email": "member@example.com", "password": "…", "verified": true}, …]

require __DIR__.'/vendor/autoload.php';

$app = require __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$model = config('auth.providers.users.model');

$accounts = json_decode(file_get_contents($argv[1] ?? 'accounts.json'), true, 512, JSON_THROW_ON_ERROR);

foreach ($accounts as $account) {
    $user = $model::query()->firstOrNew(['email' => $account['email']]);
    $user->name = $account['name'];
    $user->password = $account['password'];
    $user->email_verified_at = ($account['verified'] ?? true) ? now() : null;
    $user->save();
    printf("  %s <%s>%s\n", $user->name, $user->email, $user->email_verified_at ? '' : ' (address not verified)');
}
