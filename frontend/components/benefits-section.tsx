"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function BenefitsSection() {
  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold mb-4 text-blue-800"
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            Make Data-Driven Decisions
          </motion.h2>
          <motion.p 
            className="text-xl text-gray-600 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            Gain insights into your fleet operations and optimize maintenance costs
          </motion.p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="order-2 lg:order-1"
          >
            <h3 className="text-2xl font-bold mb-4 text-blue-700">Monthly Cost Analysis</h3>
            <p className="text-gray-600 mb-6">
              Track and analyze maintenance costs on a monthly basis. Identify trends and make data-driven decisions to optimize your fleet operations.
            </p>
            
            <ul className="space-y-4">
              <li className="flex items-start">
                <div className="mr-4 mt-1 bg-blue-100 p-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium">Detailed Expense Breakdowns</h4>
                  <p className="text-gray-500">See exactly where your maintenance budget is going each month</p>
                </div>
              </li>
              <li className="flex items-start">
                <div className="mr-4 mt-1 bg-blue-100 p-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium">Comparative Analysis</h4>
                  <p className="text-gray-500">Compare costs across different vehicles to identify high-maintenance units</p>
                </div>
              </li>
              <li className="flex items-start">
                <div className="mr-4 mt-1 bg-blue-100 p-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium">Exportable Reports</h4>
                  <p className="text-gray-500">Generate and export monthly reports for accounting and planning</p>
                </div>
              </li>
            </ul>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2"
          >
            <div className="bg-gray-100 p-4 rounded-xl overflow-hidden shadow-lg">
              <Image 
                src="/placeholder-dashboard.png"
                alt="Monthly cost analysis dashboard"
                width={600}
                height={400}
                className="rounded-lg object-cover"
              />
            </div>
          </motion.div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mt-24">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="order-1"
          >
            <div className="bg-gray-100 p-4 rounded-xl overflow-hidden shadow-lg">
              <Image 
                src="/placeholder-chart.png"
                alt="Year-over-year comparison chart"
                width={600}
                height={400}
                className="rounded-lg object-cover"
              />
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="order-2"
          >
            <h3 className="text-2xl font-bold mb-4 text-blue-700">Year-Over-Year Insights</h3>
            <p className="text-gray-600 mb-6">
              Track long-term maintenance trends and costs with year-over-year comparisons. Plan your maintenance budget more effectively based on historical data.
            </p>
            
            <ul className="space-y-4">
              <li className="flex items-start">
                <div className="mr-4 mt-1 bg-blue-100 p-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium">Long-term Trend Analysis</h4>
                  <p className="text-gray-500">Visualize maintenance costs over extended periods</p>
                </div>
              </li>
              <li className="flex items-start">
                <div className="mr-4 mt-1 bg-blue-100 p-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium">Budget Forecasting</h4>
                  <p className="text-gray-500">Predict future maintenance costs based on historical data</p>
                </div>
              </li>
              <li className="flex items-start">
                <div className="mr-4 mt-1 bg-blue-100 p-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium">Vehicle Lifecycle Analysis</h4>
                  <p className="text-gray-500">Make informed decisions about vehicle replacements</p>
                </div>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
} 