from PIL import Image
import numpy as np

def remove_background(input_path, output_path, threshold=50):
    try:
        # Load image and convert to RGBA
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()
        
        new_data = []
        for item in datas:
            # item is (R, G, B, A)
            # If pixel is dark (part of background), make it transparent
            # Assuming logo is white (high R, G, B) and background is dark/gray
            
            # Simple threshold: if brightness is low, it's background
            brightness = (item[0] + item[1] + item[2]) / 3
            
            if brightness < threshold:
                # Transparent
                new_data.append((0, 0, 0, 0))
            else:
                # Keep original (White logo)
                new_data.append(item)
        
        img.putdata(new_data)
        
        # Crop to content (optional but good for sizing)
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        img.save(output_path, "PNG")
        print(f"Successfully processed logo to: {output_path}")
        
    except Exception as e:
        print(f"Error processing image: {e}")

if __name__ == "__main__":
    # Source: Original Uploaded JPG (from User Metadata)
    # Using the path observed in previous steps
    input_file = "C:/Users/AI Fusion Labs/.gemini/antigravity/brain/77903668-f5b3-492e-bcf1-ca19f936ff6e/uploaded_image_1767761509106.jpg" 
    
    # Output: The file used in AccessGate.tsx
    output_file = "c:/AI Fusion Labs/Tavus/API/netic-sarah-app/public/netic-logo-final.png"
    
    # Also fix header logo
    output_header = "c:/AI Fusion Labs/Tavus/API/netic-sarah-app/public/netic-header-logo.png"

    print("Processing AccessGate Logo...")
    remove_background(input_file, output_file, threshold=100) # Threshold 100 catches gray/black bg
    
    print("Processing Header Logo...")
    remove_background(input_file, output_header, threshold=100)
