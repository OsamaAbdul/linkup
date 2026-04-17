const fs = require('fs');
const file = 'src/features/logistics/components/LogisticsSettings.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Toasts
txt = txt.replaceAll('toast.success("Settlement details synchronized");', 'toast.success("Payment details saved");');
txt = txt.replaceAll('toast.success("Logistics operational settings updated");', 'toast.success("Vehicle info saved");');
txt = txt.replaceAll('toast.success("Configuration settings updated");', 'toast.success("Notification settings saved");');

// Profile Registry
txt = txt.replaceAll('Profile Registry', 'My Profile');
txt = txt.replaceAll('Identity & Location Control', 'Personal details & location');

// Carrier Fleet
txt = txt.replaceAll('Carrier Fleet Settings', 'Delivery Vehicle');
txt = txt.replaceAll('Vehicle type & Transport size', 'Choose the vehicle you use');
txt = txt.replaceAll('Assigned Vehicle Type', 'Your Vehicle Type');
txt = txt.replaceAll('Logistics Note', 'Important');
txt = txt.replaceAll('Your vehicle type determines the size of packages you are eligible to transport.', 'The vehicle you select determines what size of orders you can deliver.');
txt = txt.replaceAll('Sync Fleet Data', 'Save Vehicle Info');

// Settlement Hub
txt = txt.replaceAll('Settlement Hub', 'Payment Details');
txt = txt.replaceAll('Bank accounts & Payouts', 'Where we send your earnings');
txt = txt.replaceAll('Settlement Details', 'Payment Details');
txt = txt.replaceAll('Default Bank Name', 'Bank Name');
txt = txt.replaceAll('Payment Note', 'Quick Withdrawals');
txt = txt.replaceAll('Saving these details will auto-fill your withdrawal requests for faster settlements.', "We'll use this account to pay your earnings. Saving this makes cashing out faster.");
txt = txt.replaceAll('Save Settlement Account', 'Save Bank Details');

// Configurations
txt = txt.replaceAll('Configurations', 'Notifications');
txt = txt.replaceAll('Alerts & Agent Events', 'Manage your alerts');
txt = txt.replaceAll('Agent Events', 'Delivery Alerts');
txt = txt.replaceAll('New Order Assigned', 'When I get a new order');
txt = txt.replaceAll('Order Delivered', 'When an order is completed');
txt = txt.replaceAll('Issue Reported', "When there's a problem");
txt = txt.replaceAll('Promoter Network', 'Referral Earnings');
txt = txt.replaceAll('Promoter Earnings Notification', 'When I earn money from referrals');
txt = txt.replaceAll('Save Preferences', 'Save Notifications');

fs.writeFileSync(file, txt);
console.log('Replaced jargons successfully!');
