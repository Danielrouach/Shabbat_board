// Public READ ONLY endpoint; Execute as me; Who has access: Anyone.
// Its URL is public. Never implement writes in this project.
const DATA_FILE_ID = 'REPLACE_WITH_DRIVE_FILE_ID';
function doGet(e) {
  const callback = String((e && e.parameter && e.parameter.callback) || '');
  if (!/^shabbatCloudCallback_[A-Za-z0-9_]{1,45}$/.test(callback))
    return ContentService.createTextOutput('Invalid callback').setMimeType(ContentService.MimeType.TEXT);
  let payload;
  try {
    const data = JSON.parse(DriveApp.getFileById(DATA_FILE_ID).getBlob().getDataAsString('UTF-8'));
    payload = {ok:true,data};
  } catch(err) { payload = {ok:false,error:'Data unavailable'}; }
  return ContentService.createTextOutput(callback+'('+JSON.stringify(payload).replace(/</g,'\\u003c')+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
