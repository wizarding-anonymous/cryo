#!/bin/bash

# Скрипт для запуска нагрузочных тестов User Service

set -e

echo "🚀 Запуск нагрузочных тестов User Service"
echo "========================================"

# Проверяем, установлен ли k6
if ! command -v k6 &> /dev/null; then
    echo "❌ k6 не установлен. Установите k6 для запуска тестов:"
    echo "   • macOS: brew install k6"
    echo "   • Ubuntu: sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69"
    echo "            echo 'deb https://dl.k6.io/deb stable main' | sudo tee /etc/apt/sources.list.d/k6.list"
    echo "            sudo apt-get update && sudo apt-get install k6"
    echo "   • Windows: choco install k6"
    exit 1
fi

# Проверяем, запущен ли User Service
BASE_URL=${BASE_URL:-"http://localhost:3001"}
echo "🔍 Проверяем доступность User Service на $BASE_URL..."

if ! curl -s "$BASE_URL/health" > /dev/null; then
    echo "❌ User Service недоступен на $BASE_URL"
    echo "   Убедитесь, что сервис запущен:"
    echo "   docker-compose -f docker-compose.simple.yml up -d"
    exit 1
fi

echo "✅ User Service доступен"

# Создаем директорию для результатов
mkdir -p results
cd "$(dirname "$0")"

# Функция для запуска теста
run_test() {
    local test_name=$1
    local test_file=$2
    local description=$3
    
    echo ""
    echo "📊 Запуск $test_name"
    echo "   Описание: $description"
    echo "   Файл: $test_file"
    echo "   Время начала: $(date)"
    echo ""
    
    # Запускаем тест с выводом в файл и консоль
    k6 run --out json=results/${test_name}-$(date +%Y%m%d-%H%M%S).json $test_file
    
    echo ""
    echo "✅ $test_name завершен"
    echo "   Время окончания: $(date)"
}

# Меню выбора тестов
echo ""
echo "Выберите тип тестирования:"
echo "1) Нагрузочный тест (Load Test) - проверка работы под нормальной нагрузкой"
echo "2) Стресс тест (Stress Test) - поиск точки отказа системы"
echo "3) Оба теста последовательно"
echo "4) Быстрый тест (сокращенная версия)"
echo ""

read -p "Введите номер (1-4): " choice

case $choice in
    1)
        run_test "load-test" "k6-load-test.js" "Нагрузочное тестирование до 10K пользователей"
        ;;
    2)
        run_test "stress-test" "k6-stress-test.js" "Стресс тестирование до 50K пользователей"
        ;;
    3)
        run_test "load-test" "k6-load-test.js" "Нагрузочное тестирование до 10K пользователей"
        echo ""
        echo "⏳ Пауза 30 секунд между тестами..."
        sleep 30
        run_test "stress-test" "k6-stress-test.js" "Стресс тестирование до 50K пользователей"
        ;;
    4)
        echo "🏃‍♂️ Запуск быстрого теста (2 минуты)..."
        k6 run --duration 2m --vus 100 k6-load-test.js
        ;;
    *)
        echo "❌ Неверный выбор"
        exit 1
        ;;
esac

echo ""
echo "🎉 Тестирование завершено!"
echo ""
echo "📁 Результаты сохранены в директории results/"
echo "📊 Для анализа результатов используйте:"
echo "   • k6 cloud результаты (если настроен k6 cloud)"
echo "   • Grafana dashboard (если настроен)"
echo "   • JSON файлы в директории results/"
echo ""
echo "🔧 Рекомендации:"
echo "   • Запустите тесты несколько раз для получения стабильных результатов"
echo "   • Мониторьте ресурсы системы во время тестирования"
echo "   • Сравните результаты с требованиями производительности"
echo ""