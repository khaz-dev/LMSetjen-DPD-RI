"""
HTML to PDF Converter for LMS Trial Reports
This script converts all HTML reports to PDF format using pdfkit
"""

import os
import sys

try:
    import pdfkit
except ImportError:
    print("ERROR: pdfkit is not installed.")
    print("Please install it by running: pip install pdfkit")
    print("You also need to install wkhtmltopdf:")
    print("  - Windows: Download from https://wkhtmltopdf.org/downloads.html")
    print("  - Mac: brew install wkhtmltopdf")
    print("  - Linux: sudo apt-get install wkhtmltopdf")
    sys.exit(1)

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Define HTML files to convert
HTML_FILES = [
    "Laporan_Uji_Coba_Independen_ID.html",
    "Independent_Trial_Report_EN.html",
    "Laporan_Uji_Coba_Terbatas_PKSDM_ID.html",
    "Limited_Trial_Report_PKSDM_EN.html"
]

# PDF generation options
PDF_OPTIONS = {
    'page-size': 'A4',
    'margin-top': '2.5cm',
    'margin-right': '2.5cm',
    'margin-bottom': '2.5cm',
    'margin-left': '2.5cm',
    'encoding': "UTF-8",
    'no-outline': None,
    'enable-local-file-access': None,
    'print-media-type': None
}

def convert_html_to_pdf(html_file, pdf_file):
    """
    Convert a single HTML file to PDF
    
    Args:
        html_file (str): Path to HTML file
        pdf_file (str): Path to output PDF file
    """
    try:
        print(f"Converting {os.path.basename(html_file)}...", end=" ")
        pdfkit.from_file(html_file, pdf_file, options=PDF_OPTIONS)
        print("✓ Success")
        return True
    except Exception as e:
        print(f"✗ Failed: {str(e)}")
        return False

def main():
    """Main function to convert all HTML reports to PDF"""
    print("=" * 60)
    print("LMS Trial Reports - HTML to PDF Converter")
    print("=" * 60)
    print()
    
    # Check if running from correct directory
    if not os.path.exists(os.path.join(SCRIPT_DIR, "README.md")):
        print("WARNING: This script should be run from the 'reports' directory")
        print(f"Current directory: {SCRIPT_DIR}")
        print()
    
    success_count = 0
    failed_count = 0
    
    # Convert each HTML file
    for html_filename in HTML_FILES:
        html_path = os.path.join(SCRIPT_DIR, html_filename)
        pdf_filename = html_filename.replace('.html', '.pdf')
        pdf_path = os.path.join(SCRIPT_DIR, pdf_filename)
        
        # Check if HTML file exists
        if not os.path.exists(html_path):
            print(f"Skipping {html_filename} - file not found")
            failed_count += 1
            continue
        
        # Convert to PDF
        if convert_html_to_pdf(html_path, pdf_path):
            success_count += 1
        else:
            failed_count += 1
    
    # Print summary
    print()
    print("=" * 60)
    print("Conversion Summary")
    print("=" * 60)
    print(f"Total files: {len(HTML_FILES)}")
    print(f"Successful: {success_count} ✓")
    print(f"Failed: {failed_count} ✗")
    print()
    
    if success_count > 0:
        print(f"PDF files saved in: {SCRIPT_DIR}")
    
    if failed_count > 0:
        print()
        print("If conversion failed, please make sure:")
        print("1. pdfkit is installed: pip install pdfkit")
        print("2. wkhtmltopdf is installed on your system")
        print("3. HTML files exist in the reports directory")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nConversion cancelled by user.")
        sys.exit(0)
    except Exception as e:
        print(f"\n\nERROR: {str(e)}")
        sys.exit(1)
