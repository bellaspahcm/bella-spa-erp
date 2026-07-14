import os
from PIL import Image

def process_rocket():
    src_png = "public/Tên lửa đa ngành.png"
    
    if not os.path.exists(src_png):
        print("Error: source image not found.")
        return
        
    print("Opening source image...")
    img = Image.open(src_png).convert("RGBA")
    width, height = img.size
    data = img.load()
    
    visited = set()
    to_visit = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    
    # Tolerant threshold for background white pixels
    threshold = 240
    
    print("Performing flood fill background identification...")
    while to_visit:
        x, y = to_visit.pop()
        if (x, y) in visited:
            continue
        visited.add((x, y))
        
        if x < 0 or x >= width or y < 0 or y >= height:
            continue
            
        r, g, b, a = data[x, y]
        
        # If the pixel is close to white, we mark it as transparent background
        if r >= threshold and g >= threshold and b >= threshold:
            data[x, y] = (r, g, b, 0) # Set alpha to 0
            
            # Add neighbors
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                    nr, ng, nb, na = data[nx, ny]
                    if nr >= threshold and ng >= threshold and nb >= threshold:
                        to_visit.append((nx, ny))
                        
    out_path = "public/ten_lua_da_nganh_transparent.png"
    img.save(out_path, "PNG")
    print("Successfully saved transparent image to public/ten_lua_da_nganh_transparent.png")

if __name__ == "__main__":
    process_rocket()
