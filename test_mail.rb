require 'mail'
require 'letter_opener'

Mail.defaults do
  delivery_method :letter_opener
end

Mail.deliver do
  to 'bilel.kihal.2007@gmail.com'
  from 'crous@contact.fr'
  subject 'Test Email'
  body 'This is a test email.'
end
