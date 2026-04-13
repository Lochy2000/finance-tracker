#!/usr/bin/env python3
"""
LedgerLens Backend API Testing
Tests all backend endpoints for the personal finance tracker
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class LedgerLensAPITester:
    def __init__(self, base_url: str = "https://smart-statements-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.access_token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    expected_status: int = 200, use_auth: bool = True) -> tuple[bool, Dict]:
        """Make HTTP request and validate response"""
        url = f"{self.base_url}/api{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if use_auth and self.access_token:
            headers['Authorization'] = f'Bearer {self.access_token}'

        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except Exception as e:
            return False, {"error": str(e)}

    def test_health_check(self):
        """Test basic health endpoint"""
        success, data = self.make_request('GET', '/health', use_auth=False)
        self.log_test("Health Check", success, 
                     "" if success else f"Status check failed: {data}")
        return success

    def test_login(self):
        """Test login with admin credentials"""
        login_data = {
            "email": "admin@ledgerlens.com",
            "password": "Admin123!"
        }
        
        success, data = self.make_request('POST', '/auth/login', login_data, use_auth=False)
        
        if success and 'user_id' in data:
            self.user_data = data
            # Extract token from cookies if available
            if 'access_token' in self.session.cookies:
                self.access_token = self.session.cookies['access_token']
            self.log_test("Admin Login", True)
            return True
        else:
            self.log_test("Admin Login", False, f"Login failed: {data}")
            return False

    def test_auth_me(self):
        """Test GET /api/auth/me endpoint (was previously returning 500)"""
        success, data = self.make_request('GET', '/auth/me')
        
        if success and 'user_id' in data:
            self.log_test("GET /auth/me", True)
            return True
        else:
            self.log_test("GET /auth/me", False, f"Failed to get current user: {data}")
            return False

    def test_dashboard_endpoints(self):
        """Test dashboard endpoints (were previously returning 404)"""
        endpoints = [
            ('/dashboard', 'Dashboard Summary'),
            ('/dashboard/stats', 'Dashboard Quick Stats')
        ]
        
        results = []
        for endpoint, name in endpoints:
            success, data = self.make_request('GET', endpoint)
            self.log_test(name, success, 
                         "" if success else f"Failed: {data}")
            results.append(success)
        
        return all(results)

    def test_transactions_endpoints(self):
        """Test transaction endpoints"""
        # Test get transactions
        success, data = self.make_request('GET', '/transactions')
        self.log_test("GET /transactions", success, 
                     "" if success else f"Failed: {data}")
        
        # Test get categories
        success2, data2 = self.make_request('GET', '/transactions/categories')
        self.log_test("GET /transactions/categories", success2, 
                     "" if success2 else f"Failed: {data2}")
        
        # Test transaction search
        success3, data3 = self.make_request('GET', '/transactions?search=test&limit=10')
        self.log_test("Transaction Search", success3, 
                     "" if success3 else f"Failed: {data3}")
        
        return success and success2 and success3

    def test_insights_endpoints(self):
        """Test insights endpoints"""
        endpoints = [
            ('/insights', 'Insights Summary'),
            ('/insights/recurring', 'Recurring Payments'),
            ('/insights/unusual', 'Unusual Spending'),
            ('/insights/savings', 'Savings Suggestions'),
            ('/insights/compare?period1_start=2024-01-01&period1_end=2024-01-31&period2_start=2024-02-01&period2_end=2024-02-28', 'Period Comparison')
        ]
        
        results = []
        for endpoint, name in endpoints:
            success, data = self.make_request('GET', endpoint)
            self.log_test(name, success, 
                         "" if success else f"Failed: {data}")
            results.append(success)
        
        return all(results)

    def test_reports_endpoints(self):
        """Test reports endpoints"""
        # Test get reports
        success, data = self.make_request('GET', '/reports')
        self.log_test("GET /reports", success, 
                     "" if success else f"Failed: {data}")
        
        # Test generate report
        report_data = {
            "start_date": (datetime.now() - timedelta(days=30)).isoformat(),
            "end_date": datetime.now().isoformat(),
            "categories": ["Groceries", "Transport"],
            "format": "summary"
        }
        
        success2, data2 = self.make_request('POST', '/reports/generate', report_data)
        self.log_test("POST /reports/generate", success2, 
                     "" if success2 else f"Failed: {data2}")
        
        return success and success2

    def test_settings_endpoints(self):
        """Test settings endpoints"""
        success, data = self.make_request('GET', '/settings')
        self.log_test("GET /settings", success, 
                     "" if success else f"Failed: {data}")
        return success

    def test_files_endpoints(self):
        """Test file upload endpoints"""
        success, data = self.make_request('GET', '/files')
        self.log_test("GET /files", success, 
                     "" if success else f"Failed: {data}")
        return success

    def test_registration_flow(self):
        """Test user registration"""
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@example.com"
        register_data = {
            "email": test_email,
            "password": "TestPass123!",
            "name": "Test User"
        }
        
        success, data = self.make_request('POST', '/auth/register', register_data, use_auth=False)
        self.log_test("User Registration", success, 
                     "" if success else f"Registration failed: {data}")
        return success

    def test_logout(self):
        """Test logout functionality"""
        success, data = self.make_request('POST', '/auth/logout')
        self.log_test("Logout", success, 
                     "" if success else f"Logout failed: {data}")
        return success

    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("🚀 Starting LedgerLens Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)
        
        # Basic connectivity
        if not self.test_health_check():
            print("❌ Health check failed - stopping tests")
            return False
        
        # Authentication flow
        if not self.test_login():
            print("❌ Login failed - stopping tests")
            return False
        
        # Core API tests (these were the main fixes)
        self.test_auth_me()
        self.test_dashboard_endpoints()
        self.test_transactions_endpoints()
        self.test_insights_endpoints()
        self.test_reports_endpoints()
        self.test_settings_endpoints()
        self.test_files_endpoints()
        
        # Additional flows
        self.test_registration_flow()
        self.test_logout()
        
        # Summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if success_rate < 80:
            print("⚠️  Multiple API failures detected")
            return False
        elif success_rate < 100:
            print("⚠️  Some tests failed but core functionality working")
            return True
        else:
            print("✅ All tests passed!")
            return True

    def get_test_summary(self):
        """Get detailed test summary"""
        failed_tests = [t for t in self.test_results if not t['success']]
        passed_tests = [t for t in self.test_results if t['success']]
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": len(passed_tests),
            "failed_tests": len(failed_tests),
            "success_rate": (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0,
            "passed_test_names": [t['test'] for t in passed_tests],
            "failed_test_details": failed_tests
        }


def main():
    """Main test execution"""
    tester = LedgerLensAPITester()
    
    try:
        success = tester.run_all_tests()
        
        # Save detailed results
        summary = tester.get_test_summary()
        with open('/app/backend_test_results.json', 'w') as f:
            json.dump(summary, f, indent=2)
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        return 1


if __name__ == "__main__":
    sys.exit(main())