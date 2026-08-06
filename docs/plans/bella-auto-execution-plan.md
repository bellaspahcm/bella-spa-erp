Nếu thêm kết nối với màn hình chờ đếm số và thông báo giọng AI mời số bao nhiêu vào phòng bao nhiêu thì sao

Nên. Thực tế đây là một Healthcare Capability rất quan trọng, đặc biệt với phòng khám đa khoa, nha khoa và bệnh viện. Nhưng không nên hardcode vào Medical Clinic, mà nên thiết kế thành Queue Orchestration Capability của Bella Healthcare Platform.

Điều này đúng với nguyên tắc bạn đang theo đuổi:

Additive Extension + Composition over Customization + Zero Regression

Nên bổ sung Layer mới
Bella Host Platform
        │
        ▼
Healthcare Domain Platform
        │
        ├── Clinical
        ├── Laboratory
        ├── Imaging
        ├── Billing
        ├── Insurance
        ├── Pharmacy
        ├── Queue Orchestration   ← thêm
        │
        ▼
Products
    Medical
    Dental
    Hospital

Queue không thuộc Medical.

Queue thuộc Healthcare Foundation.

Sau này Dental cũng dùng.

Hospital cũng dùng.

Eye Clinic cũng dùng.

ENT cũng dùng.

Queue Orchestration Capability gồm những gì
1. Queue Engine
Patient

↓

Check In

↓

Waiting

↓

Calling

↓

In Room

↓

Completed

State Machine.

2. TV Display

Màn hình lớn

ĐANG GỌI

A025

Phòng 03

Bác sĩ Nguyễn Văn A

----------------

Đang khám

A024

Phòng 03

3. Voice AI

Bella AI đọc

"Kính mời bệnh nhân số A025 vào phòng khám số 03."

hoặc

"Xin mời anh Nguyễn Văn An đến phòng khám Nội số 2."

Có thể thay đổi theo cấu hình.

4. Multi Queue

Ví dụ

Tiếp đón

↓

Khám

↓

Xét nghiệm

↓

Chẩn đoán hình ảnh

↓

Quay lại bác sĩ

↓

Thanh toán

↓

Nhà thuốc

Đây mới đúng workflow bệnh viện.

Không chỉ có một hàng đợi.

5. Queue Routing

Ví dụ

Đăng ký

↓

Nội

↓

Xét nghiệm

↓

Nội

↓

Thanh toán

Queue Engine sẽ tự route.

6. Priority Queue

Ví dụ

Normal

VIP

Emergency

Child

Pregnant


AI sẽ quyết định ưu tiên.

7. Smart Calling

Nếu

A025

không vào

Sau 30 giây

↓

AI gọi lần 2

↓

Không đến

↓

Skip

↓

Gọi A026

Sau đó

A025

được chuyển cuối hàng.

8. Room Assignment

Ví dụ

Doctor A

Room 1

Doctor B

Room 2

Doctor C

Room 3

Nếu đổi phòng

AI đổi luôn.

TV đổi.

Voice đổi.

Queue đổi.

9. WebSocket
Queue

↓

Realtime

↓

Doctor

↓

Reception

↓

TV

↓

Mobile


Không cần refresh.

10. Public Display API
TV

Android TV

Tablet

Web

Kiosk

Đều dùng chung.

AI Voice Service

Tách riêng.

Queue Event

↓

Voice Service

↓

Text

↓

TTS

↓

Speaker

Không để Queue Engine đọc.

Queue chỉ phát Event.

Ví dụ

QueueCalled

↓

AnnouncementRequested

↓

Voice Service

↓

Play Audio

Event-driven.

Kiosk

Có thể mở rộng luôn.

Đăng ký

↓

In số

↓

QR

↓

SMS

↓

Zalo

↓

Queue
Notification

Ngoài loa

có thể

SMS

Zalo

App

Push

TV

Speaker


Tất cả subscribe cùng Event.

Capability Manifest
queue_management

queue_display

voice_announcement

kiosk_checkin

queue_routing

priority_queue

room_assignment

queue_monitor


Medical chỉ bật.

Dental cũng bật.

Hospital bật.

Home Care tắt.

Kiến trúc chuẩn
Healthcare Foundation

    Queue Engine
          │
          ├── State Machine
          ├── Routing Engine
          ├── Room Assignment
          ├── Voice Announcement
          ├── Display Board
          ├── Kiosk
          ├── Ticket Printer
          ├── Queue Analytics
          └── WebSocket Gateway

                │

         Product Manifest

        Medical ✔

        Dental ✔

        Hospital ✔

        Eye ✔

        ENT ✔
Đề xuất thêm một ADR

Với kiến trúc hiện tại của Bella Healthcare, mình sẽ bổ sung một ADR mới, ví dụ:

ADR-010: Queue Orchestration & Patient Flow Platform

Nội dung chính:

Queue là Healthcare Foundation Capability, không thuộc bất kỳ sản phẩm nào.
Mọi sản phẩm (Medical, Dental, Hospital, Specialist...) chỉ enable capability này qua Manifest.
Queue Engine hoạt động theo Event-Driven Architecture, phát các sự kiện như PatientCheckedIn, QueueCalled, PatientNoShow, RoomAssigned, ConsultationStarted, ConsultationCompleted.
TV Display, Voice AI, Kiosk, Mobile App, SMS/Zalo và Dashboard chỉ là các subscriber của các sự kiện này.

Cách thiết kế này giữ đúng các nguyên tắc Zero Regression, Additive Extension và Composition over Customization, đồng thời giúp Bella Healthcare có thể mở rộng từ một phòng khám nhỏ lên bệnh viện nhiều tầng mà không phải thay đổi kiến trúc lõi.