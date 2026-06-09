# 🚀 Hybrid WMS Automation: Web & Android App Orchestrator

## 📌 Overview
An advanced hybrid automation engine built to synchronize operational data seamlessly between Google Sheets, a Web Management System (WMS), and an internal Android application. 

This bot orchestrates a two-phase data entry process: first automating headless Chrome for initial customer registration, followed by ADB (Android Debug Bridge) automation to pair hardware serial numbers inside an emulator.

## 🧠 Core Engineering Highlights
- **Cross-Platform Orchestration:** Automatically switches context between Web DOM manipulation (Puppeteer) and Android UI interaction (ADB/UIAutomator).
- **Dynamic State Memory:** Implements a local JSON caching system to remember and handle duplicate customer names dynamically within Flutter-based dropdown UIs.
- **Advanced UI Parsing:** Uses custom Regex to parse raw Android XML dumps, allowing exact-match coordinate clicks to bypass overlapping UI elements and hidden buttons.
- **Smart Data Pipeline:** Merges manual clipboard inputs with Google Sheets data in real-time before executing the automation queue.

## 🛠️ Tech Stack
- Node.js
- Puppeteer (Web Automation)
- ADB & UIAutomator (Android Automation)
- Google Sheets API

> **⚠️ Security Note:** 
> Local customer history databases (`history_customer.json`), `.env` variables, and Google Cloud credentials have been safely excluded via `.gitignore` to maintain strict privacy and data compliance.