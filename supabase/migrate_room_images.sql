-- If you already ran an older schema, run this instead of re-dropping tables:
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE rooms SET
	image_url = 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1400&q=80',
	description = 'Cozy standard room with soft lighting, queen bed, and essential comforts for a restful stay.'
WHERE number = '101' AND (image_url IS NULL OR image_url = '');

UPDATE rooms SET
	image_url = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1400&q=80',
	description = 'Bright twin-ready standard room with clean finishes and a calm city-stay vibe.'
WHERE number = '102' AND (image_url IS NULL OR image_url = '');

UPDATE rooms SET
	image_url = 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1400&q=80',
	description = 'Spacious deluxe room with premium bedding, work desk, and a more elevated guest experience.'
WHERE number = '201' AND (image_url IS NULL OR image_url = '');

UPDATE rooms SET
	image_url = 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80',
	description = 'Premium suite with lounge space, refined interiors, and room to unwind in style.'
WHERE number = '301' AND (image_url IS NULL OR image_url = '');
