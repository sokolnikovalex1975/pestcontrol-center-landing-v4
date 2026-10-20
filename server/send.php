<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Логирование ошибок без вывода технических данных посетителю.
ini_set('log_errors', '1');
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Единый формат ответа сервера.
function respond(int $status, array $data): void
{
    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
    );

    exit;
}

// Принимаем только POST-запросы.
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');

    respond(405, [
        'success' => false,
        'message' => 'Метод не поддерживается.'
    ]);
}

// Проверяем источник запроса, если браузер передал Origin.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$httpHost = $_SERVER['HTTP_HOST'] ?? '';

if ($origin !== '') {
    $originHost = parse_url($origin, PHP_URL_HOST);
    $siteHost = parse_url('https://' . $httpHost, PHP_URL_HOST);

    if (
        !$originHost ||
        !$siteHost ||
        strcasecmp($originHost, $siteHost) !== 0
    ) {
        respond(403, [
            'success' => false,
            'message' => 'Запрос отклонён.'
        ]);
    }
}

// Подключаем PHPMailer.
$autoload = __DIR__ . '/vendor/autoload.php';

if (!is_file($autoload)) {
    error_log('Audit form error: vendor/autoload.php not found');

    respond(500, [
        'success' => false,
        'message' => 'Ошибка настройки отправки. Попробуйте позже.'
    ]);
}

require $autoload;

// SMTP-настройки.
$smtpHost = 'smtp.timeweb.ru';
// Логин почты Timeweb для кириллического домена указывается в punycode.
$smtpUsername = 'info@xn----itbbsflddbfpfdodg9d0f.xn--p1ai';
$smtpPassword = 'ПАРОЛЬ_ПОЧТЫ'; // настоящий пароль хранится только на сервере
$smtpPort = 465;

// Отправитель и получатель.
$fromEmail = 'info@xn----itbbsflddbfpfdodg9d0f.xn--p1ai';
$fromName = 'Заявка на аудит объекта';
$toEmail = 'АДРЕС_ДЛЯ_ЗАЯВОК@example.ru'; // настоящий адрес указан только на сервере

// Чтение и ограничение длины полей.
function field(string $key, int $maxLength = 2000): string
{
    $value = $_POST[$key] ?? '';

    if (!is_string($value)) {
        respond(400, [
            'success' => false,
            'message' => 'Некорректные данные формы.'
        ]);
    }

    $value = trim($value);

    $length = function_exists('mb_strlen')
        ? mb_strlen($value, 'UTF-8')
        : strlen($value);

    if ($length > $maxLength) {
        respond(400, [
            'success' => false,
            'message' => 'Одно из полей слишком длинное.'
        ]);
    }

    return $value;
}

// Получаем данные формы.
$name    = field('name', 150);
$company = field('company', 250);
$phone   = field('phone', 30);
$email   = field('email', 254);
$type    = field('type', 150);
$msg     = field('msg', 3000);

// Проверяем обязательные поля.
$nameLength = function_exists('mb_strlen')
    ? mb_strlen($name, 'UTF-8')
    : strlen($name);

if ($nameLength < 2) {
    respond(422, [
        'success' => false,
        'message' => 'Проверьте имя.'
    ]);
}

$digits = preg_replace('/\D/', '', $phone);

if (strlen($digits) !== 11) {
    respond(422, [
        'success' => false,
        'message' => 'Проверьте номер телефона.'
    ]);
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(422, [
        'success' => false,
        'message' => 'Проверьте адрес электронной почты.'
    ]);
}

// Разрешённые значения поля «Тип объекта».
$allowedTypes = [
    'Пищевое производство',
    'Ресторан или кафе',
    'Гостиница',
    'Магазин или торговая сеть',
    'Склад, логистика',
    'Элеватор, комбикормовый завод',
    'Другое',
];

if (!in_array($type, $allowedTypes, true)) {
    respond(422, [
        'success' => false,
        'message' => 'Выберите тип объекта.'
    ]);
}

// Экранирование пользовательских данных для HTML-письма.
$escape = static function (string $value): string {
    return htmlspecialchars(
        $value,
        ENT_QUOTES | ENT_SUBSTITUTE,
        'UTF-8'
    );
};

// Фиксируем факт согласия на обработку персональных данных (доказательство для оператора, ч. 3 ст. 9 152-ФЗ).
$consentVersion = '20.10.2026';
$consentAt = (new DateTimeImmutable('now', new DateTimeZone('Europe/Moscow')))->format('d.m.Y H:i:s');
$clientIp = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
$consentNote = 'Согласие на обработку персональных данных дано нажатием кнопки «Отправить заявку» '
    . '(текст согласия: https://пестконтроль-центр.рф/soglasie/, редакция от ' . $consentVersion . '). '
    . 'Дата и время: ' . $consentAt . ' (МСК). IP-адрес: ' . ($clientIp !== '' ? $clientIp : 'не определён') . '.';

// Создаём письмо и отправляем через SMTP.
$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->SMTPDebug = 0; // 2 — подробный журнал SMTP для диагностики
$mail->Debugoutput = static function ($str, $level) {
    error_log("PHPMailer [$level]: $str");
};
    $mail->Host       = $smtpHost;
    $mail->SMTPAuth   = true;
    $mail->Username   = $smtpUsername;
    $mail->Password   = $smtpPassword;
    $mail->Port       = $smtpPort;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->CharSet    = 'UTF-8';
    $mail->Timeout    = 15;

    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($toEmail);

    // Ответ на заявку можно отправить посетителю.
    if ($email !== '') {
        $mail->addReplyTo($email, $name);
    }

    $mail->isHTML(true);
    $mail->Subject = 'Заявка на аудит объекта';

    $mail->Body =
        '<h2>Новая заявка на аудит объекта</h2>' .
        '<p><b>Имя:</b> ' . $escape($name) . '</p>' .
        '<p><b>Компания или объект:</b> ' .
            $escape($company) . '</p>' .
        '<p><b>Телефон:</b> ' . $escape($phone) . '</p>' .
        '<p><b>E-mail:</b> ' . $escape($email) . '</p>' .
        '<p><b>Тип объекта:</b> ' . $escape($type) . '</p>' .
        '<p><b>Комментарий:</b><br>' .
            nl2br($escape($msg)) . '</p>' .
        '<hr><p style="color:#666;font-size:12px">' . $escape($consentNote) . '</p>';

    $mail->AltBody =
        "Новая заявка на аудит объекта\n\n" .
        "Имя: {$name}\n" .
        "Компания или объект: {$company}\n" .
        "Телефон: {$phone}\n" .
        "E-mail: {$email}\n" .
        "Тип объекта: {$type}\n" .
        "Комментарий: {$msg}\n\n" .
        "{$consentNote}\n";

    // Успех возвращаем только после подтверждения отправки SMTP.
    $mail->send();

    respond(200, [
        'success' => true,
        'message' => 'Заявка успешно отправлена.'
    ]);

} catch (\Throwable $e) {
    // Подробности остаются в серверном журнале.
    error_log(
        'Audit form SMTP error: ' .
        $e->getMessage() .
        ' | ' .
        $mail->ErrorInfo
    );

    respond(500, [
        'success' => false,
        'message' => 'Не удалось отправить заявку. Попробуйте позже.'
    ]);
}