<?php
// /ui/html-preview-images/upload-handler.php

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? 'upload';

// Путь к папке для хранения изображений
$uploadDir = dirname(__DIR__, 2) . '/assets/html-images';
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0775, true);
}

// Разрешенные расширения
$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$maxFileSize = 5 * 1024 * 1024; // 5 MB

function sendJson(array $data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

switch ($action) {
    case 'upload':
        handleUpload($uploadDir, $allowedExtensions, $maxFileSize);
        break;
    
    case 'list':
        handleList($uploadDir);
        break;
    
    case 'delete':
        handleDelete($uploadDir);
        break;
    
    default:
        sendJson(['ok' => false, 'error' => 'Unknown action']);
}

function handleUpload($uploadDir, $allowedExtensions, $maxFileSize) {
    if (!isset($_FILES['images'])) {
        sendJson(['ok' => false, 'error' => 'Нет файлов для загрузки']);
    }

    $files = $_FILES['images'];
    $uploadedFiles = [];
    $errors = [];

    // Обработка множественной загрузки
    $fileCount = is_array($files['name']) ? count($files['name']) : 1;

    for ($i = 0; $i < $fileCount; $i++) {
        $fileName = is_array($files['name']) ? $files['name'][$i] : $files['name'];
        $fileTmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
        $fileSize = is_array($files['size']) ? $files['size'][$i] : $files['size'];
        $fileError = is_array($files['error']) ? $files['error'][$i] : $files['error'];

        // Проверка ошибок загрузки
        if ($fileError !== UPLOAD_ERR_OK) {
            $errors[] = "Ошибка загрузки файла: $fileName";
            continue;
        }

        // Проверка размера
        if ($fileSize > $maxFileSize) {
            $errors[] = "Файл $fileName слишком большой (макс. 5 МБ)";
            continue;
        }

        // Проверка расширения
        $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        if (!in_array($fileExt, $allowedExtensions)) {
            $errors[] = "Недопустимый формат файла: $fileName";
            continue;
        }

        // Генерация уникального имени файла
        $baseName = pathinfo($fileName, PATHINFO_FILENAME);
        $baseName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $baseName);
        $uniqueName = $baseName . '_' . time() . '_' . uniqid() . '.' . $fileExt;
        $destination = $uploadDir . '/' . $uniqueName;

        // Перемещение файла
        if (move_uploaded_file($fileTmpName, $destination)) {
            $uploadedFiles[] = [
                'filename' => $uniqueName,
                'original' => $fileName,
                'url' => '/assets/html-images/' . $uniqueName,
                'size' => $fileSize
            ];
        } else {
            $errors[] = "Не удалось сохранить файл: $fileName";
        }
    }

    if (empty($uploadedFiles) && !empty($errors)) {
        sendJson(['ok' => false, 'error' => implode(', ', $errors)]);
    }

    sendJson([
        'ok' => true,
        'uploaded' => $uploadedFiles,
        'errors' => $errors
    ]);
}

function handleList($uploadDir) {
    if (!is_dir($uploadDir)) {
        sendJson(['ok' => true, 'images' => []]);
    }

    $images = [];
    $files = scandir($uploadDir);

    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        
        $filePath = $uploadDir . '/' . $file;
        if (!is_file($filePath)) continue;

        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) continue;

        $images[] = [
            'filename' => $file,
            'url' => '/assets/html-images/' . $file,
            'size' => filesize($filePath),
            'modified' => filemtime($filePath)
        ];
    }

    // Сортировка по дате модификации (новые первыми)
    usort($images, function($a, $b) {
        return $b['modified'] - $a['modified'];
    });

    sendJson(['ok' => true, 'images' => $images]);
}

function handleDelete($uploadDir) {
    $input = json_decode(file_get_contents('php://input'), true);
    $filename = $input['filename'] ?? '';

    if (empty($filename)) {
        sendJson(['ok' => false, 'error' => 'Не указано имя файла']);
    }

    // Защита от path traversal
    $filename = basename($filename);
    $filePath = $uploadDir . '/' . $filename;

    if (!file_exists($filePath)) {
        sendJson(['ok' => false, 'error' => 'Файл не найден']);
    }

    if (unlink($filePath)) {
        sendJson(['ok' => true, 'message' => 'Файл удален']);
    } else {
        sendJson(['ok' => false, 'error' => 'Не удалось удалить файл']);
    }
}