<?php

use App\Models\User;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;
use Laravel\Socialite\Two\User as GoogleUser;

/**
 * Make Socialite return a Google user built from the given userinfo claims.
 *
 * @param  array<string, mixed>  $claims
 */
function signInWithGoogleAs(array $claims): void
{
    $claims = array_merge([
        'sub' => 'google-123',
        'name' => 'Joy Bermudo',
        'email' => 'joy@dmezzanine.ph',
        'email_verified' => true,
    ], $claims);

    $googleUser = (new GoogleUser)->setRaw($claims)->map([
        'id' => $claims['sub'],
        'name' => $claims['name'],
        'email' => $claims['email'],
    ]);

    Socialite::shouldReceive('driver->user')->andReturn($googleUser);
}

test('redirects to Google without limiting the account domain', function () {
    $response = $this->get('/auth/google');

    $response->assertRedirectContains('accounts.google.com');
    expect($response->headers->get('Location'))->not->toContain('hd=');
});

test('signs in an active user with any email domain and links their Google account', function (string $email, string $googleEmail) {
    $user = User::factory()->create(['email' => $email]);
    signInWithGoogleAs(['email' => $googleEmail]);

    $response = $this->get('/auth/google/callback');

    $response->assertRedirect(route('home', absolute: false));
    $this->assertAuthenticatedAs($user);
    expect($user->fresh()->google_id)->toBe('google-123');
})->with([
    'company address' => ['joy@dmezzanine.ph', 'Joy@DMezzanine.ph'],
    'personal Gmail' => ['joy.bermudo@gmail.com', 'joy.bermudo@gmail.com'],
]);

test('rejects a Google account whose email Google has not verified', function () {
    User::factory()->create(['email' => 'joy@dmezzanine.ph']);
    signInWithGoogleAs(['email_verified' => false]);

    $response = $this->get('/auth/google/callback');

    $response->assertRedirect(route('login'))
        ->assertSessionHasErrors(['google' => 'Google has not verified that email address yet. Verify it with Google, then try again.']);
    $this->assertGuest();
});

test('rejects a Google account with no matching user', function () {
    signInWithGoogleAs(['email' => 'new.hire@dmezzanine.ph']);

    $response = $this->get('/auth/google/callback');

    $response->assertSessionHasErrors(['google' => "There's no D' Mezzanine account for new.hire@dmezzanine.ph. Ask the owner to add you."]);
    $this->assertGuest();
});

test('rejects an inactive user', function () {
    User::factory()->inactive()->create(['email' => 'joy@dmezzanine.ph']);
    signInWithGoogleAs([]);

    $response = $this->get('/auth/google/callback');

    $response->assertSessionHasErrors(['google' => 'Your account is switched off. Ask the owner to turn it back on.']);
    $this->assertGuest();
});

test('rejects a user already linked to a different Google account', function () {
    $user = User::factory()->create(['email' => 'joy@dmezzanine.ph', 'google_id' => 'google-original']);
    signInWithGoogleAs(['sub' => 'google-other']);

    $response = $this->get('/auth/google/callback');

    $response->assertSessionHasErrors(['google' => 'That account is linked to a different Google sign-in. Ask the owner to check it.']);
    $this->assertGuest();
    expect($user->fresh()->google_id)->toBe('google-original');
});

test('asks the user to try again when the Google sign-in state has expired', function () {
    Socialite::shouldReceive('driver->user')->andThrow(new InvalidStateException);

    $response = $this->get('/auth/google/callback');

    $response->assertRedirect(route('login'))
        ->assertSessionHasErrors(['google' => 'Google sign-in expired. Please try again.']);
    $this->assertGuest();
});
