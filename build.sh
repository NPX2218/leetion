#!/bin/bash
zip -r leetion.zip . -x "*.git*" -x ".DS_Store" -x "content/*" -x "README.md" -x "LICENSE" -x ".gitignore" -x "build.sh" -x "*.zip"
echo "Done! Created leetion.zip"
