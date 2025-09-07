#!/usr/bin/env python3
"""
Ultra Simple Screenshot Tool for Jens
Just press Ctrl+Shift+S to take screenshot
"""

import os
import sys
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import messagebox
import time

# Only use built-in libraries and PIL
try:
    from PIL import Image, ImageGrab
except ImportError:
    print("Please install Pillow: pip install pillow")
    sys.exit(1)

class UltraSimpleScreenshot:
    def __init__(self):
        self.script_dir = Path(__file__).parent
        self.screenshots_dir = self.script_dir / "Rettelser"
        self.screenshots_dir.mkdir(exist_ok=True)
        
        # Create GUI window
        self.root = tk.Tk()
        self.root.title("Jens Screenshot Tool")
        self.root.geometry("300x150")
        self.root.resizable(False, False)
        
        # Keep window on top and in center
        self.center_window()
        
        # Create GUI elements
        self.create_gui()
        
    def center_window(self):
        """Center the window on screen"""
        self.root.withdraw()  # Hide window temporarily
        self.root.update_idletasks()  # Update window size
        
        # Calculate center position
        width = 300
        height = 150
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        x = (screen_width // 2) - (width // 2)
        y = (screen_height // 2) - (height // 2)
        
        self.root.geometry(f"{width}x{height}+{x}+{y}")
        self.root.deiconify()  # Show window
        
    def create_gui(self):
        """Create simple GUI"""
        # Title label
        title_label = tk.Label(
            self.root, 
            text="Jens Screenshot Tool", 
            font=("Arial", 14, "bold"),
            pady=10
        )
        title_label.pack()
        
        # Instructions
        instructions = tk.Label(
            self.root,
            text="Tryk på knappen for at tage screenshot\neller brug Ctrl+Shift+S",
            font=("Arial", 10),
            pady=5
        )
        instructions.pack()
        
        # Screenshot button
        screenshot_btn = tk.Button(
            self.root,
            text="📸 Tag Screenshot",
            font=("Arial", 12),
            bg="#4CAF50",
            fg="white",
            pady=10,
            command=self.take_screenshot_gui
        )
        screenshot_btn.pack(pady=10)
        
        # Status label
        self.status_label = tk.Label(
            self.root,
            text="Klar til screenshot",
            font=("Arial", 9),
            fg="green"
        )
        self.status_label.pack()
        
        # Bind keyboard shortcut
        self.root.bind('<Control-Shift-S>', lambda e: self.take_screenshot_gui())
        self.root.bind('<Control-s>', lambda e: self.take_screenshot_gui())
        
        # Window close event
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
    def take_screenshot_gui(self):
        """Take screenshot with GUI feedback"""
        try:
            self.status_label.config(text="Tager screenshot...", fg="orange")
            self.root.update()
            
            # Hide window temporarily
            self.root.withdraw()
            time.sleep(0.1)  # Small delay to ensure window is hidden
            
            # Take screenshot
            screenshot = ImageGrab.grab()
            
            # Show window again
            self.root.deiconify()
            
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            filename = f"screenshot_{timestamp}.png"
            filepath = self.screenshots_dir / filename
            
            # Save screenshot
            screenshot.save(filepath, 'PNG')
            
            # Update latest reference
            self.update_latest_screenshot(filename)
            
            # Show success
            danish_date = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
            file_size_kb = round(filepath.stat().st_size / 1024, 1)
            
            self.status_label.config(
                text=f"SUCCESS! {filename} ({file_size_kb}KB)", 
                fg="green"
            )
            
            # Log the screenshot
            self.log_screenshot(filename, danish_date)
            
            # Show success message
            messagebox.showinfo(
                "Screenshot Gemt!",
                f"Screenshot gemt som:\n{filename}\n\n"
                f"Dato: {danish_date}\n"
                f"Størrelse: {file_size_kb}KB\n\n"
                f"Skriv 'screenshot' til Claude for analyse!"
            )
            
            print(f"Screenshot saved: {filename}")
            
        except Exception as e:
            self.status_label.config(text=f"FEJL: {str(e)}", fg="red")
            messagebox.showerror("Fejl", f"Kunne ikke tage screenshot:\n{str(e)}")
            print(f"Error: {e}")
    
    def update_latest_screenshot(self, filename):
        """Update reference to latest screenshot for Claude"""
        latest_file = self.screenshots_dir / "LATEST.txt"
        with open(latest_file, 'w', encoding='utf-8') as f:
            f.write(filename)
    
    def log_screenshot(self, filename, danish_date):
        """Log screenshot to file with Danish date"""
        log_file = self.screenshots_dir / "screenshot-log.txt"
        log_entry = f"{danish_date} - {filename}\n"
        
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(log_entry)
    
    def on_closing(self):
        """Handle window close"""
        self.root.quit()
        self.root.destroy()
    
    def run(self):
        """Run the application"""
        print("Ultra Simple Screenshot Tool started!")
        print(f"Screenshots save to: {self.screenshots_dir}")
        self.root.mainloop()

if __name__ == "__main__":
    try:
        app = UltraSimpleScreenshot()
        app.run()
    except Exception as e:
        print(f"Error: {e}")
        input("Press Enter to exit...")  # Keep console open to see error
        sys.exit(1)