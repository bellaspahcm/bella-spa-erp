import os
import subprocess
import sys

def install_pillow():
    try:
        import PIL
        print("Pillow is already installed.")
    except ImportError:
        print("Pillow not found. Installing Pillow...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
            print("Pillow installed successfully.")
        except Exception as e:
            print(f"Failed to install Pillow: {e}")
            sys.exit(1)

def generate_icons():
    from PIL import Image
    
    logo_path = os.path.join("public", "logo.png")
    icons_dir = os.path.join("public", "icons")
    
    if not os.path.exists(logo_path):
        print(f"Error: {logo_path} does not exist.")
        sys.exit(1)
        
    os.makedirs(icons_dir, exist_ok=True)
    
    try:
        with Image.open(logo_path) as img:
            # Generate 192x192
            img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
            img_192.save(os.path.join(icons_dir, "icon-192x192.png"), "PNG")
            print("Generated icon-192x192.png")
            
            # Generate 512x512
            img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
            img_512.save(os.path.join(icons_dir, "icon-512x512.png"), "PNG")
            print("Generated icon-512x512.png")
            
    except Exception as e:
        print(f"Error generating icons: {e}")
        sys.exit(1)

if __name__ == "__main__":
    install_pillow()
    generate_icons()
