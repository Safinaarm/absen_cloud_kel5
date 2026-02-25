<?php

class QrService
{
    public function generate()
    {
        return [
            "ok" => true,
            "data" => [
                "qr_token" => "TKN-" . strtoupper(bin2hex(random_bytes(4))),
                "course_id" => "cloud-101",
                "session_id" => "sesi-" . rand(100000, 999999),
                "expires_at" => date("c", strtotime("+10 minutes"))
            ]
        ];
    }
}