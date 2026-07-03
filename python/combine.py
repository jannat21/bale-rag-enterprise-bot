import pandas as pd
import re

# خواندن فایل دوره‌ها (با فرض اینکه Sheet اول است)
courses_df = pd.read_excel('دوره ها به تفکیک هر دوره.xlsx', sheet_name=0)

# خواندن فایل موسسات (ردیف‌های غیرضروری را حذف می‌کنیم)
institutes_df = pd.read_excel('لیست موسسات.xlsx', sheet_name=0, skiprows=2)
institutes_df.columns = ['institute', 'address', 'phone']  # نام ستون‌ها را تنظیم می‌کنیم

# ترکیب دو دیتافریم با کلید 'موسسه' (ستون A در فایل دوره‌ها = institute)
merged_df = pd.merge(courses_df, institutes_df, left_on='موسسه', right_on='institute', how='left')

# تابع کمکی برای استخراج عدد سن از رشته '۶ تا ۹ سال'
def extract_age_range(age_str):
    if pd.isna(age_str):
        return None, None
    # حذف کلمات و فقط نگه‌داری اعداد
    numbers = re.findall(r'\d+', str(age_str))
    if len(numbers) >= 2:
        return int(numbers[0]), int(numbers[1])
    elif len(numbers) == 1:
        # حالت '۱۸ سال به بالا'
        return int(numbers[0]), 99  # یا None
    else:
        return None, None

# تابع کمکی برای نرمال‌سازی قیمت (تبدیل به عدد تومان)
def normalize_price(price_str):
    if pd.isna(price_str):
        return None
    price_str = str(price_str).replace('تومان', '').strip()
    # اگر بازه بود (مثلاً ۱۰۰۰۰۰۰ تا ۱۵۰۰۰۰۰)
    if 'تا' in price_str:
        parts = price_str.split('تا')
        if len(parts) == 2:
            # می‌توان میانگین گرفت یا هر دو را نگه داشت، اینجا میانگین را برمی‌گردانیم
            nums = re.findall(r'\d+', parts[0] + parts[1])
            if len(nums) >= 2:
                return (int(nums[0]) + int(nums[1])) // 2
    # اگر عدد دقیق بود
    nums = re.findall(r'\d+', price_str)
    if nums:
        return int(nums[0])
    return None

# اعمال توابع بر روی ستون‌ها
merged_df['min_age'], merged_df['max_age'] = zip(*merged_df['بازه سنی'].apply(extract_age_range))
merged_df['price_normalized'] = merged_df['مبلغ دوره'].apply(normalize_price)

# انتخاب ستون‌های نهایی با نام‌های مورد نظر
final_df = merged_df[['institute', 'address', 'phone', 'عنوان دوره', 'price_normalized', 'min_age', 'max_age', 'مقطع']]
final_df.columns = ['institute', 'address', 'phone', 'title', 'price_normalized', 'min_age', 'max_age', 'grade']

# نمایش ۵ ردیف اول
print(final_df.head())

# ذخیره در فایل CSV (اختیاری)
final_df.to_csv('courses_combined.csv', index=False, encoding='utf-8-sig')