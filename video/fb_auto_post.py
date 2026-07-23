import requests
import time

# ==========================================
# 1. ตั้งค่าตัวแปร (คุณต้องนำค่าของเพจคุณมาใส่ที่นี่)
# ==========================================
PAGE_ACCESS_TOKEN = 'ใส่_PAGE_ACCESS_TOKEN_ของคุณที่นี่'
PAGE_ID = 'ใส่_PAGE_ID_ของคุณที่นี่'

# ข้อความสำหรับโพสต์หลัก
POST_MESSAGE = """
สวัสดีครับ นี่คือโพสต์ทดสอบจากระบบอัตโนมัติ! 🤖
กำลังทดสอบการทำงานของการสร้าง First Comment
"""

# ข้อความสำหรับคอมเมนต์แรก
FIRST_COMMENT_MESSAGE = "นี่คือคอมเมนต์แรกอัตโนมัติ! สนใจดูรายละเอียดเพิ่มเติมคลิก: https://example.com"

def create_post_with_first_comment():
    """
    ฟังก์ชันสำหรับสร้างโพสต์บน Facebook Page และตามด้วยคอมเมนต์แรก
    """
    # ------------------------------------------
    # ขั้นตอนที่ 1: โพสต์ข้อความหลักลงเพจ
    # ------------------------------------------
    post_url = f"https://graph.facebook.com/v19.0/{PAGE_ID}/feed"
    post_payload = {
        'message': POST_MESSAGE,
        'access_token': PAGE_ACCESS_TOKEN
    }
    
    print("กำลังโพสต์ข้อความหลัก...")
    post_response = requests.post(post_url, data=post_payload)
    post_data = post_response.json()
    
    if 'id' not in post_data:
        print("❌ เกิดข้อผิดพลาดในการโพสต์:")
        print(post_data)
        return

    post_id = post_data['id']
    print(f"✅ โพสต์สำเร็จ! (Post ID: {post_id})")
    
    # หน่วงเวลาเล็กน้อย (1-2 วินาที) เพื่อให้ Facebook ประมวลผลโพสต์หลักเสร็จ
    time.sleep(2)
    
    # ------------------------------------------
    # ขั้นตอนที่ 2: คอมเมนต์ใต้โพสต์ที่เพิ่งสร้าง
    # ------------------------------------------
    comment_url = f"https://graph.facebook.com/v19.0/{post_id}/comments"
    comment_payload = {
        'message': FIRST_COMMENT_MESSAGE,
        'access_token': PAGE_ACCESS_TOKEN
    }
    
    print("กำลังสร้างคอมเมนต์แรก...")
    comment_response = requests.post(comment_url, data=comment_payload)
    comment_data = comment_response.json()
    
    if 'id' in comment_data:
        print(f"✅ สร้างคอมเมนต์แรกสำเร็จ! (Comment ID: {comment_data['id']})")
    else:
        print("❌ เกิดข้อผิดพลาดในการสร้างคอมเมนต์:")
        print(comment_data)

if __name__ == "__main__":
    create_post_with_first_comment()
