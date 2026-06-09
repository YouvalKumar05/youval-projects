import json
import re

def safe_json_parse(text):
    """
    Robust JSON parser for LLM outputs.
    Handles:
    - Markdown blocks
    - Trailing commas
    - Single quotes
    - Truncated JSON
    - Extraction fallback
    """

    if not text or not isinstance(text, str):
        return []

    try:
        # -------------------------------
        # 1. CLEAN MARKDOWN
        # -------------------------------
        cleaned = text.strip()
        cleaned = re.sub(r"```json", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"```", "", cleaned)
        cleaned = cleaned.strip()

        # -------------------------------
        # 2. REMOVE INVALID CHARACTERS
        # -------------------------------
        cleaned = cleaned.replace("\n", " ").replace("\r", " ")

        # -------------------------------
        # 3. FIX COMMON JSON ISSUES
        # -------------------------------

        # Fix single quotes → double quotes
        cleaned = re.sub(r"'", '"', cleaned)

        # Remove trailing commas
        cleaned = re.sub(r',\s*([\}\]])', r'\1', cleaned)

        # -------------------------------
        # 4. TRY DIRECT PARSE
        # -------------------------------
        try:
            return json.loads(cleaned)
        except Exception as e:
            print("Direct parse failed:", str(e))

        # -------------------------------
        # 5. FIX TRUNCATED JSON (SMART)
        # -------------------------------
        # Balance brackets cautiously
        if cleaned.count('[') > cleaned.count(']'):
            cleaned += ']' * (cleaned.count('[') - cleaned.count(']'))

        if cleaned.count('{') > cleaned.count('}'):
            cleaned += '}' * (cleaned.count('{') - cleaned.count('}'))

        try:
            return json.loads(cleaned)
        except Exception as e:
            print("Balanced parse failed:", str(e))

        # -------------------------------
        # 6. EXTRACT JSON ARRAY (NON-GREEDY)
        # -------------------------------
        match = re.search(r'\[.*?\]', cleaned, re.DOTALL)
        if match:
            try:
                extracted = match.group()
                extracted = re.sub(r',\s*([\}\]])', r'\1', extracted)
                return json.loads(extracted)
            except Exception as e:
                print("Array extraction failed:", str(e))

        # -------------------------------
        # 7. EXTRACT JSON OBJECT
        # -------------------------------
        match = re.search(r'\{.*?\}', cleaned, re.DOTALL)
        if match:
            try:
                extracted = match.group()
                extracted = re.sub(r',\s*([\}\]])', r'\1', extracted)
                return json.loads(extracted)
            except Exception as e:
                print("Object extraction failed:", str(e))

    except Exception as e:
        print("Unexpected parsing error:", str(e))

    # -------------------------------
    # 8. FAIL SAFE
    # -------------------------------
    print("Final fallback: returning empty list")
    return []
