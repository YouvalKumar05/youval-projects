from routes.executions import _generate_playwright_script

test_json = {
    "actions": [
        {"type": "goto", "url": "https://google.com"},
        {"type": "waitforselector", "selector": "#search"},
        {"type": "fill", "selector": "#search", "value": "test"}
    ]
}

print(_generate_playwright_script(1, "Test", test_json))
