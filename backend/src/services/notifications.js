const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter;

// Inicializar transporte de email
const initializeEmailService = () => {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Enviar email para nuevo joven registrado
const sendNewYouthNotification = async (monitor, joven, evento) => {
  if (!transporter) initializeEmailService();

  const subject = `Nuevo participante: ${joven.nombre} ${joven.apellidos}`;
  const htmlContent = `
    <h2>Nuevo participante registrado</h2>
    <p>Hola ${monitor.nombre_mostrado},</p>
    <p><strong>${joven.nombre} ${joven.apellidos}</strong> se ha apuntado a tu grupo
    en el evento "<strong>${evento.nombre}</strong>".</p>
    <p>Puedes ver su ficha desde el panel de gestión.</p>
    <hr/>
    <p><small>Este mensaje es automático, no respondas a este correo.</small></p>
  `;

  try {
    await transporter.sendMail({
      from: process.env.NOTIFY_FROM,
      to: monitor.email,
      subject,
      html: htmlContent,
    });
    console.log(`✓ Email sent to ${monitor.email}`);
  } catch (err) {
    console.error('Email send error:', err);
    // No fallar la operación principal si el email falla
  }
};

// Enviar email de documento recibido
const sendDocumentNotification = async (monitor, joven, tipoDocumento, evento) => {
  if (!transporter) initializeEmailService();

  const subject = `Documento recibido: ${tipoDocumento} de ${joven.nombre}`;
  const htmlContent = `
    <h2>Documento recibido</h2>
    <p>Hola ${monitor.nombre_mostrado},</p>
    <p>Se ha recibido un documento <strong>${tipoDocumento}</strong> de
    <strong>${joven.nombre} ${joven.apellidos}</strong> em el evento "<strong>${evento.nombre}</strong>".</p>
    <p>Revísalo en el panel de gestión.</p>
    <hr/>
    <p><small>Este mensaje es automático, no respondas a este correo.</small></p>
  `;

  try {
    await transporter.sendMail({
      from: process.env.NOTIFY_FROM,
      to: monitor.email,
      subject,
      html: htmlContent,
    });
    console.log(`✓ Document notification email sent to ${monitor.email}`);
  } catch (err) {
    console.error('Email send error:', err);
  }
};

// Enviar email de cambio de contraseña
const sendPasswordChangeEmail = async (email, nombreMostrado) => {
  if (!transporter) initializeEmailService();

  const subject = 'Tu contraseña ha sido cambiada';
  const htmlContent = `
    <h2>Cambio de contraseña</h2>
    <p>Hola ${nombreMostrado},</p>
    <p>Tu contraseña ha sido cambiada exitosamente.</p>
    <p>Si no fuiste tú quien realizó este cambio, cambia tu contraseña inmediatamente
    y contacta al administrador.</p>
    <hr/>
    <p><small>Este mensaje es automático, no respondas a este correo.</small></p>
  `;

  try {
    await transporter.sendMail({
      from: process.env.NOTIFY_FROM,
      to: email,
      subject,
      html: htmlContent,
    });
    console.log(`✓ Password change notification sent to ${email}`);
  } catch (err) {
    console.error('Email send error:', err);
  }
};

const sendPublicContactNotification = async ({ nombre, email, asunto, mensaje }) => {
  if (!transporter) initializeEmailService();

  const target = process.env.CONTACT_TO || process.env.NOTIFY_FROM || process.env.SMTP_USER;
  if (!target) {
    return;
  }

  const subject = `Contacto: ${asunto}`;
  const htmlContent = `
    <h2>Nuevo mensaje de contacto</h2>
    <p><strong>Nombre:</strong> ${nombre}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Asunto:</strong> ${asunto}</p>
    <p><strong>Mensaje:</strong></p>
    <p>${mensaje}</p>
  `;

  try {
    await transporter.sendMail({
      from: process.env.NOTIFY_FROM,
      to: target,
      replyTo: email,
      subject,
      html: htmlContent,
    });
  } catch (err) {
    console.error('Contact email send error:', err);
  }
};

module.exports = {
  initializeEmailService,
  sendNewYouthNotification,
  sendDocumentNotification,
  sendPasswordChangeEmail,
  sendPublicContactNotification,
};
