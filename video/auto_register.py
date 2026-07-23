import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# ==========================================
# 1. ข้อมูลส่วนตัวสำหรับกรอก (ต้องแก้ให้เป็นข้อมูลจริง)
# ==========================================
USER_DATA = {
    "first_name": "สมชาย",
    "last_name": "สายวิ่ง",
    "id_card": "1234567890123",
    "phone": "0812345678",
    "email": "somchai@email.com",
    "blood_type": "O",          # อาจจะเป็น Dropdown
    "shirt_size": "L",          # อาจจะเป็น Dropdown
    "emergency_name": "สมศรี",
    "emergency_phone": "0898765432"
}

# URL ของหน้าสมัคร
TARGET_URL = "https://runrace.in.th/skylanerun"

def main():
    print("🚀 เริ่มต้นระบบ Auto-Register")
    
    # ตั้งค่า Chrome ให้ทำงาน
    options = webdriver.ChromeOptions()
    # ปิดบรรทัดล่างนี้ถ้าต้องการดูบอททำงานบนหน้าจอ (ถ้าใส่ --headless บอทจะทำงานแบบซ่อนหน้าต่าง)
    # options.add_argument('--headless') 
    
    # เปิด Browser
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    wait = WebDriverWait(driver, 10) # รอโหลดแต่ละจุดสูงสุด 10 วินาที

    try:
        print(f"กำลังเข้าสู่เว็บไซต์: {TARGET_URL}")
        driver.get(TARGET_URL)

        # -------------------------------------------------------------------------
        # คำเตือน: คุณต้องเปลี่ยน "ID_หรือ_CLASS_ของช่อง..." ให้ตรงกับโค้ดของเว็บจริงๆ 
        # (หาได้จากการคลิกขวาที่ช่องกรอกใน Chrome แล้วเลือก "Inspect" หรือ "ตรวจสอบ")
        # -------------------------------------------------------------------------
        
        # รอจนกว่าปุ่ม "สมัครเลย" (ตัวอย่าง) จะโผล่ขึ้นมาและกดคลิก
        print("รอปุ่มสมัคร...")
        # สมมติว่าปุ่มสมัครมี id = "btn-register"
        # register_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-register")))
        # register_btn.click()

        print("กำลังกรอกข้อมูล...")
        
        # ตัวอย่างการกรอกชื่อ (สมมติช่องกรอกชื่อมี id="firstname")
        # first_name_field = wait.until(EC.presence_of_element_located((By.ID, "firstname")))
        # first_name_field.send_keys(USER_DATA["first_name"])

        # ตัวอย่างการกรอกนามสกุล (สมมติช่องมี name="lastname")
        # last_name_field = driver.find_element(By.NAME, "lastname")
        # last_name_field.send_keys(USER_DATA["last_name"])

        # ตัวอย่างการกรอกเลขบัตร ปชช. (สมมติช่องมี class="id-card-input")
        # id_card_field = driver.find_element(By.CLASS_NAME, "id-card-input")
        # id_card_field.send_keys(USER_DATA["id_card"])

        # การเลือกไซส์เสื้อจาก Dropdown (สมมติเป็น <select id="shirt-size">)
        # จากไลบรารี selenium.webdriver.support.ui import Select
        # shirt_dropdown = Select(driver.find_element(By.ID, "shirt-size"))
        # shirt_dropdown.select_by_value(USER_DATA["shirt_size"])

        # ตัวอย่างการกดปุ่ม "ยืนยันการสมัคร" (สมมติปุ่มมีข้อความว่า "Submit")
        print("เตรียมกดยืนยัน...")
        # submit_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Submit')]")
        # submit_btn.click()
        
        print("✅ สคริปต์ทำงานเสร็จสิ้น! (กรุณาเช็คหน้าจอว่ามีให้กด CAPTCHA หรือไม่)")
        
        # พักหน้าจอไว้ให้ดูผล 30 วินาทีก่อนปิด
        time.sleep(30)

    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {e}")
    finally:
        driver.quit()
        print("ปิดเบราว์เซอร์")

if __name__ == "__main__":
    main()
