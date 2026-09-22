INSERT INTO users (id,email,name,role,created_at) VALUES
('op_northstar','ops@northstar.example','Northstar Aviation','operator',unixepoch()*1000),
('op_meridian','dispatch@meridian.example','Aero Meridian','operator',unixepoch()*1000),
('traveller_demo','traveller@example.com','Demo Traveller','traveller',unixepoch()*1000);
INSERT INTO listings (id,operator_id,"from",from_code,"to",to_code,departure_at,aircraft,seats,price,status,created_at) VALUES
('leg-1','op_northstar','London','LTN','Nice','NCE','2026-09-22T09:40','Citation Latitude',7,6800,'live',unixepoch()*1000),
('leg-2','op_meridian','Paris','LBG','Ibiza','IBZ','2026-09-22T16:15','Phenom 300E',6,5200,'live',unixepoch()*1000),
('leg-3','op_northstar','Milan','LIN','Mykonos','JMK','2026-09-23T11:20','Challenger 350',8,8900,'live',unixepoch()*1000),
('leg-4','op_meridian','Geneva','GVA','Farnborough','FAB','2026-09-24T07:10','Pilatus PC-24',7,4900,'live',unixepoch()*1000);
