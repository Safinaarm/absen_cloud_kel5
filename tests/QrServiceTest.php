<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../src/QrService.php';

class QrServiceTest extends TestCase
{
    public function testGenerateQrSuccess()
    {
        $service = new QrService();
        $result = $service->generate();

        // ASSERT
        $this->assertTrue($result['ok']);
        $this->assertArrayHasKey('data', $result);
        $this->assertArrayHasKey('qr_token', $result['data']);
        $this->assertArrayHasKey('course_id', $result['data']);
        $this->assertArrayHasKey('session_id', $result['data']);
        $this->assertArrayHasKey('expires_at', $result['data']);
    }

    public function testQrTokenFormat()
    {
        $service = new QrService();
        $result = $service->generate();

        $this->assertStringStartsWith(
            'TKN-',
            $result['data']['qr_token']
        );
    }
}