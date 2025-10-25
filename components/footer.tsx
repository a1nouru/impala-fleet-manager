import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-blue-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-xl mb-4">Impala Express</h3>
            <p className="text-blue-200 mb-4">
              Fleet management and inventory tracking made easy.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-blue-200 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
              <a href="#" className="text-blue-200 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
                </svg>
              </a>
              <a href="#" className="text-blue-200 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="font-bold mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#features" className="text-blue-200 hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#" className="text-blue-200 hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="#" className="text-blue-200 hover:text-white transition-colors">
                  Demo
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="text-blue-200 hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="#" className="text-blue-200 hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="#" className="text-blue-200 hover:text-white transition-colors">
                  Careers
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="text-blue-200 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="text-blue-200 hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="#" className="text-blue-200 hover:text-white transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-blue-800 mt-12 pt-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-blue-200">
            &copy; {new Date().getFullYear()} Impala Express. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0">
            <select className="bg-blue-800 text-blue-200 py-1 px-2 rounded border border-blue-700">
              <option>English (US)</option>
              <option>Portuguese</option>
              <option>French</option>
            </select>
          </div>
        </div>
      </div>
    </footer>
  );
} 