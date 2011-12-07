<?php
// Must be in the format 'user' => 'token'
$users = array(
    'myuser' => 'mypass'
);

// Read the input
$input = file_get_contents('php://input');

// Verify the user
if (!isset($_SERVER['HTTP_X_USERNAME']) || !isset($users[$_SERVER['HTTP_X_USERNAME']])) {
    header('HTTP/1.1 403 Forbidden');
    exit('Error: No authorization');
}

$token = $users[$_SERVER['HTTP_X_USERNAME']];

if (!isset($_SERVER['HTTP_X_SIGNATURE']) || ($_SERVER['HTTP_X_SIGNATURE'] !== sha1($input . $token))) {
    header('HTTP/1.1 403 Forbidden');
    exit('Error: No authorization');
}

// Write the file
do {
    $filename = 'caps/' . substr(md5(microtime()), 0, 6) . '.png';
} while(file_exists($filename));

file_put_contents($filename, base64_decode($input));

// Generate the target URL
if (isset($_SERVER['FCGI_ROLE'])) {
    $path = $_SERVER['REQUEST_URI'];
} else {
    $path = $_SERVER['PHP_SELF'];
}

$path = trim(dirname($path), '/');

if (strlen($path) > 0) {
    $path .= '/';
}

echo 'http://' . $_SERVER['HTTP_HOST'] . '/' . $path . $filename;
