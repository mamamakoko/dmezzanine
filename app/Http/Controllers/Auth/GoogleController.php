<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;
use Throwable;

class GoogleController extends Controller
{
    /**
     * Send the user to Google's account chooser.
     */
    public function redirect(): SymfonyRedirectResponse
    {
        return Socialite::driver('google')->redirect();
    }

    /**
     * Sign in the staff member Google sends back, if their verified email belongs to an active user.
     */
    public function callback(Request $request): RedirectResponse
    {
        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (InvalidStateException) {
            return $this->reject('Google sign-in expired. Please try again.');
        } catch (Throwable $exception) {
            report($exception);

            return $this->reject('Google sign-in did not complete. Please try again.');
        }

        $email = Str::lower((string) $googleUser->getEmail());

        if (($googleUser->getRaw()['email_verified'] ?? false) !== true) {
            return $this->reject('Google has not verified that email address yet. Verify it with Google, then try again.');
        }

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if ($user === null) {
            return $this->reject("There's no D' Mezzanine account for {$email}. Ask the owner to add you.");
        }

        if (! $user->active) {
            return $this->reject('Your account is switched off. Ask the owner to turn it back on.');
        }

        if ($user->google_id !== null && $user->google_id !== $googleUser->getId()) {
            return $this->reject('That account is linked to a different Google sign-in. Ask the owner to check it.');
        }

        $user->forceFill(['google_id' => $googleUser->getId()])->save();

        Auth::login($user);

        $request->session()->regenerate();

        return redirect()->intended(route('home', absolute: false));
    }

    /**
     * Return to the sign-in page with the reason sign-in was refused.
     */
    private function reject(string $message): RedirectResponse
    {
        return redirect()->route('login')->withErrors(['google' => $message]);
    }
}
