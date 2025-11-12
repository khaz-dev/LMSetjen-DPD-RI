#!/usr/bin/env python
"""
Certificate QR Code Fix Script
Generates validation tokens for existing certificates

Usage:
  python manage.py shell < populate_validation_tokens.py
  
Or in Django shell:
  exec(open('populate_validation_tokens.py').read())
"""

from api.models import Certificate
from shortuuid import ShortUUID
import sys

def populate_validation_tokens():
    """Generate validation tokens for certificates missing them"""
    
    print("=" * 70)
    print("🔧 Certificate Validation Token Population Script")
    print("=" * 70)
    
    # Initialize ShortUUID generator (same as in model)
    su = ShortUUID(
        alphabet="abcdefghijklmnopqrstuvwxyz0123456789",
        length=12
    )
    
    # Check current status
    all_certs = Certificate.objects.all()
    certs_with_token = all_certs.filter(validation_token__isnull=False)
    certs_without_token = all_certs.filter(validation_token__isnull=True)
    
    print(f"\n📊 Current Status:")
    print(f"  Total certificates: {all_certs.count()}")
    print(f"  With validation_token: {certs_with_token.count()}")
    print(f"  Without validation_token: {certs_without_token.count()}")
    
    if certs_without_token.count() == 0:
        print("\n✅ All certificates already have validation tokens!")
        print("   No action needed.")
        return True
    
    print(f"\n🔄 Generating validation tokens for {certs_without_token.count()} certificates...")
    
    successful = 0
    failed = 0
    failed_certs = []
    
    for idx, cert in enumerate(certs_without_token, 1):
        try:
            # Generate unique token
            max_attempts = 100
            attempts = 0
            
            while attempts < max_attempts:
                new_token = su.random()
                
                # Check if token already exists
                if not Certificate.objects.filter(validation_token=new_token).exists():
                    cert.validation_token = new_token
                    cert.save()
                    successful += 1
                    
                    # Progress indicator
                    if idx % 10 == 0:
                        print(f"  ✓ Processed {idx}/{certs_without_token.count()} certificates")
                    
                    break
                
                attempts += 1
            
            if attempts >= max_attempts:
                print(f"  ✗ Failed to generate unique token for certificate {cert.id}")
                failed += 1
                failed_certs.append(cert.id)
        
        except Exception as e:
            print(f"  ✗ Error processing certificate {cert.id}: {str(e)}")
            failed += 1
            failed_certs.append(cert.id)
    
    # Verify results
    print(f"\n✅ Completed!")
    print(f"  Successfully updated: {successful} certificates")
    print(f"  Failed: {failed} certificates")
    
    if failed_certs:
        print(f"  Failed IDs: {failed_certs}")
    
    # Final verification
    remaining_without_token = Certificate.objects.filter(validation_token__isnull=True).count()
    print(f"\n🔍 Final Verification:")
    print(f"  Certificates without token: {remaining_without_token}")
    
    if remaining_without_token == 0:
        print("  ✅ All certificates now have validation tokens!")
        
        # Show sample
        sample = Certificate.objects.first()
        if sample:
            print(f"\n📋 Sample Certificate:")
            print(f"  Certificate ID: {sample.certificate_id}")
            print(f"  Validation Token: {sample.validation_token}")
            print(f"  User: {sample.user.full_name if sample.user else 'N/A'}")
            print(f"  Course: {sample.course.title if sample.course else 'N/A'}")
        
        return True
    else:
        print(f"  ⚠️  {remaining_without_token} certificates still need tokens")
        return False

if __name__ == '__main__':
    try:
        success = populate_validation_tokens()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Fatal error: {str(e)}")
        sys.exit(1)
