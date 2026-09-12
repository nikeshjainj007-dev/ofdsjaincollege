from pydantic import BaseModel, Field
from typing import List, Optional

class OrderItemCreate(BaseModel):
    menu_item_id: int
    item_name: str
    price: float
    quantity: int = Field(gt=0)
    special_notes: Optional[str] = None

class OrderCreate(BaseModel):
    student_name: str
    student_phone: str
    delivery_type: str = "delivery"  # "delivery" or "pickup"
    location_block: str
    location_room: Optional[str] = ""
    outlet_id: int
    outlet_name: str
    items: List[OrderItemCreate]
    coupon_code: Optional[str] = None
    payment_method: str = "cod"  # Strictly Cash on Delivery

class StatusUpdate(BaseModel):
    status: str
    pin: Optional[str] = None
    role: Optional[str] = "vendor"

class CouponValidateRequest(BaseModel):
    code: str
    subtotal: float

class StockToggleRequest(BaseModel):
    in_stock: bool
