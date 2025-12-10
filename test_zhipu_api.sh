#!/bin/bash

# Zhipu GLM-4-Voice API Test Script
# Usage: ./test_zhipu_api.sh <audio_file.wav>

# Configuration
ZHIPU_API_KEY="95b0172f52594e7886ad6f353a991dd9.feIwLW6x4Ylhj2W8"
API_ENDPOINT="https://open.bigmodel.cn/api/paas/v4/chat/completions"
MODEL="glm-4-voice"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [ "$#" -lt 1 ]; then
    echo -e "${YELLOW}Usage: $0 <audio_file.wav> [instruction]${NC}"
    echo ""
    echo "Examples:"
    echo "  $0 test.wav"
    echo "  $0 test.wav '你好，请复述这段音频'"
    exit 1
fi

AUDIO_FILE="$1"
INSTRUCTION="${2:-请认真听这段音频，然后用中文和我对话。}"

# Check if audio file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo -e "${RED}Error: Audio file '$AUDIO_FILE' not found${NC}"
    exit 1
fi

echo -e "${BLUE}=== Zhipu GLM-4-Voice API Test ===${NC}"
echo -e "API Key: ${ZHIPU_API_KEY:0:20}..."
echo -e "Audio File: $AUDIO_FILE"
echo -e "Model: $MODEL"
echo -e "Instruction: $INSTRUCTION"
echo ""

# Convert audio file to base64
echo -e "${YELLOW}[1/3] Converting audio to base64...${NC}"
AUDIO_BASE64=$(base64 < "$AUDIO_FILE" | tr -d '\n')
AUDIO_SIZE=${#AUDIO_BASE64}
echo -e "${GREEN}✓ Audio converted ($AUDIO_SIZE bytes)${NC}"
echo ""

# Prepare JSON payload
echo -e "${YELLOW}[2/3] Preparing API request...${NC}"

# Create the request JSON
REQUEST_JSON=$(cat <<EOF
{
  "model": "$MODEL",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "$INSTRUCTION"
        },
        {
          "type": "input_audio",
          "input_audio": {
            "data": "$AUDIO_BASE64",
            "format": "wav"
          }
        }
      ]
    }
  ],
  "stream": false
}
EOF
)

echo -e "${GREEN}✓ Request prepared${NC}"
echo ""

# Send request to API
echo -e "${YELLOW}[3/3] Sending request to Zhipu API...${NC}"
echo -e "Endpoint: $API_ENDPOINT"
echo ""

RESPONSE=$(curl -s -X POST "$API_ENDPOINT" \
  -H "Authorization: Bearer $ZHIPU_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_JSON")

# Check if response is valid
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ API request failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ API request completed${NC}"
echo ""

# Parse and display response
echo -e "${BLUE}=== API Response ===${NC}"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Extract text response
TEXT_RESPONSE=$(echo "$RESPONSE" | jq -r '.choices[0].message.content[] | select(.type=="text") | .text' 2>/dev/null)
if [ -n "$TEXT_RESPONSE" ]; then
    echo -e "${GREEN}Text Response:${NC}"
    echo "$TEXT_RESPONSE"
    echo ""
fi

# Extract audio response info
AUDIO_RESPONSE=$(echo "$RESPONSE" | jq -r '.choices[0].message.content[] | select(.type=="audio") | .audio.data' 2>/dev/null)
if [ -n "$AUDIO_RESPONSE" ]; then
    echo -e "${GREEN}Audio Response:${NC}"
    echo -e "  Length: ${#AUDIO_RESPONSE} bytes (base64)"
    
    # Decode and save audio
    OUTPUT_FILE="zhipu_response_$(date +%s).wav"
    echo "$AUDIO_RESPONSE" | base64 -d > "$OUTPUT_FILE"
    
    if [ -f "$OUTPUT_FILE" ]; then
        FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
        echo -e "  Saved to: ${GREEN}$OUTPUT_FILE${NC} ($FILE_SIZE bytes)"
    fi
    echo ""
fi

# Check for errors
ERROR=$(echo "$RESPONSE" | jq -r '.error' 2>/dev/null)
if [ "$ERROR" != "null" ] && [ -n "$ERROR" ]; then
    echo -e "${RED}API Error:${NC}"
    echo "$ERROR" | jq '.'
    exit 1
fi

echo -e "${GREEN}✓ Test completed successfully${NC}"
