<?php

it('sends guests from the home page to sign in', function () {
    $response = $this->get('/');

    $response->assertRedirect('/login');
});
