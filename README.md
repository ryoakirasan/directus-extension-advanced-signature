# Directus Extension: Advanced Signature Interface

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Directus Version](https://img.shields.io/badge/Directus-%5E10.10.0-ff69b4)](https://directus.io/)

An advanced signature interface for Directus that supports both online handwriting and mobile QR code signing, featuring realistic brush strokes and multi-language support.

---

## Feature Screenshots

*   **Online Handwriting Mode**:
    ![Signature Interface](/assets/sig_interface.jpg)

*   **Signature Effect**:
    ![Signature Effect](/assets/online_sig.jpg)

*   **Mobile Signing Mode**:
  
    https://github.com/user-attachments/assets/15e48820-2f3f-4c01-b370-952f19d71e09


---

## Feature Overview

### 1. Dual Signing Modes
This extension provides a flexible signature experience through two distinct modes:
*   **Online Writing**: Users can sign directly on a canvas within the Directus item form, with realistic brush stroke effects powered by `smooth-signature`.
*   **Mobile Scan**: Generates a unique QR code. Users can scan it with their mobile phones to open a dedicated signing page, which is ideal for touch screen devices.

### 2. Cross-Device Coordination
*   **Real-time Polling**: After the QR code is generated, the PC interface polls a backend endpoint to wait for the mobile signature to be submitted.
*   **Instant Data Transfer**: Once the signature is submitted on the mobile device, it is instantly sent back and displayed in the Directus form field.

### 3. Enhanced User Experience
*   **Realistic Brush Strokes**: Simulates real handwriting with variable line width based on drawing speed.
*   **Forced Landscape on Mobile**: The mobile signing page automatically switches to a landscape layout, even when the phone is held vertically, providing a larger and more natural signing area.
*   **Undo/Clear Functionality**: Both PC and mobile interfaces support undoing the last stroke and clearing the entire canvas.

### 5. Data Structure
*   The signature is saved as a JSON object in the database, containing:
    *   `image`: The Base64 encoded signature image (PNG).
    *   `signed_by`: The ID of the user who performed the action.
    *   `signed_by_name`: The full name of the user.
    *   `timestamp`: The time the signature was saved.

---

## Directory Structure

```
+ src/
  + advanced-signature/      # Frontend Interface Logic (Vue)
    - index.js
    - interface.vue
    + locales/               # Internationalization Language Files
      - en.json
      - zh-CN.json
      - ...
  + signature-bridge/        # Backend Endpoint Logic (Node.js)
    - index.js
    - smooth-signature.js    # Injected library
```

---

## Important Notes

1.  **Directus `PUBLIC_URL`**:
    *   Please ensure that the `PUBLIC_URL` environment variable in your Directus `.env` file is correctly configured (e.g., `PUBLIC_URL="https://your-directus-domain.com"`). The QR code generated for mobile signing depends on this URL to be accessible from external devices.

2.  **Field Type**:
    *   This interface should be used with a field of type **JSON** in your data model.

---

## How to Use

### 1. Install the Extension

1.  **Clone the repository** (or download the source code) into your Directus `extensions` folder.
    ```bash
    cd /path/to/your/directus/extensions
    git clone https://github.com/your-username/directus-extension-advanced-signature.git
    cd directus-extension-advanced-signature
    ```

2.  **Install dependencies**:
    ```bash
    # Using pnpm
    pnpm install
    # Using npm
    # npm install
    ```

3.  **Build the extension**:
    ```bash
    pnpm run build
    # npm run build
    ```

4.  **Restart the Directus service**:
    If you are using Docker, restart the Directus container:
    ```bash
    docker-compose restart directus
    ```
    This will load the new extension.

### 2. Configure in Directus

1.  **Navigate to your Data Model**: Go to **Settings** -> **Data Model** and choose a collection.
2.  **Add a New Field**: Create a new field or edit an existing one.
3.  **Set the Type**: Choose **JSON** as the field type.
4.  **Select the Interface**: In the "Interface" panel on the left, find and select **"Advanced Signature"**.
5.  Save the field configuration.

Now, when you create or edit an item in that collection, you will see the Advanced Signature component.

---

## Development and Contribution

Contributions are welcome! Please feel free to fork the repository, make your changes, and open a Pull Request.

---

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
