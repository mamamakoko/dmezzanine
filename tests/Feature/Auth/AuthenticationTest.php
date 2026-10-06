<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['auth.password_login' => true]);
});

test('login screen can be rendered', function () {
    $response = $this->get('/login');

    $response->assertStatus(200);
});

test('users can authenticate using the login screen', function () {
    $user = User::factory()->create();

    $response = $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('home', absolute: false));
});

test('users can not authenticate with invalid password', function () {
    $user = User::factory()->create();

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $this->assertGuest();
});

test('users can logout', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/logout');

    $this->assertGuest();
    $response->assertRedirect('/');
});

test('inactive users can not authenticate with their password', function () {
    $user = User::factory()->inactive()->create();

    $response = $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertSessionHasErrors(['email' => __('auth.failed')]);
    $this->assertGuest();
});

test('password sign-in and reset are unavailable when password login is off', function (string $method, string $uri) {
    config(['auth.password_login' => false]);
    $user = User::factory()->create();

    $response = $this->call($method, $uri, ['email' => $user->email, 'password' => 'password']);

    $response->assertNotFound();
    $this->assertGuest();
})->with([
    'sign in' => ['POST', '/login'],
    'reset link screen' => ['GET', '/forgot-password'],
    'send reset link' => ['POST', '/forgot-password'],
    'reset screen' => ['GET', '/reset-password/token'],
    'reset password' => ['POST', '/reset-password'],
]);

test('login screen offers only Google when password login is off', function () {
    config(['auth.password_login' => false]);

    $response = $this->get('/login');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('landing')
        ->where('canPasswordLogin', false));
});
