// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.

/* global FormData */

import FauxtonAPI from "../../../core/api";
import { deleteRequest } from "../../../core/ajax";
import ActionTypes from "./actiontypes";

var currentUploadHttpRequest;

function initDocEditor (params) {
  var doc = params.doc;

  // ensure a clean slate
  FauxtonAPI.dispatch({ type: ActionTypes.RESET_DOC });

  doc.fetch().then(function () {
    FauxtonAPI.dispatch({
      type: ActionTypes.DOC_LOADED,
      options: {
        doc: doc
      }
    });

    if (params.onLoaded) {
      params.onLoaded();
    }
  }, function (xhr) {
    if (xhr.status === 404) {
      errorNotification(`The ${doc.id} document does not exist.`);
    }

    FauxtonAPI.navigate(FauxtonAPI.urls('allDocs', 'app', params.database.id, ''));
  });
}

function saveDoc (doc, isValidDoc, onSave) {
  if (isValidDoc) {
    FauxtonAPI.addNotification({
      msg: 'Saving document.',
      clear: true
    });

    doc.save().then(function () {
      onSave(doc.prettyJSON());
      FauxtonAPI.navigate('#/' + FauxtonAPI.urls('allDocs', 'app',  FauxtonAPI.url.encode(doc.database.id)), {trigger: true});
    }).fail(function (xhr) {
      FauxtonAPI.addNotification({
        msg: 'Save failed: ' + JSON.parse(xhr.responseText).reason,
        type: 'error',
        fade: false,
        clear: true
      });
    });

  } else if (doc.validationError && doc.validationError === 'Cannot change a documents id.') {
    errorNotification('You cannot edit the _id of an existing document. Try this: Click \'Clone Document\', then change the _id on the clone before saving.');
    delete doc.validationError;
  } else {
    errorNotification('Please fix the JSON errors and try saving again.');
  }
}

function showDeleteDocModal () {
  FauxtonAPI.dispatch({ type: ActionTypes.SHOW_DELETE_DOC_CONFIRMATION_MODAL });
}

function hideDeleteDocModal () {
  FauxtonAPI.dispatch({ type: ActionTypes.HIDE_DELETE_DOC_CONFIRMATION_MODAL });
}

function deleteDoc (doc) {
  const databaseName = doc.database.safeID();
  const query = '?rev=' + doc.get('_rev');
  const url = FauxtonAPI.urls('document', 'server', databaseName, doc.safeID(), query);
  deleteRequest(url).then(res => {
    if (res.error) {
      throw new Error(res.reason || res.error);
    }
    FauxtonAPI.addNotification({
      msg: 'Your document has been successfully deleted.',
      type: 'success',
      clear: true
    });
    FauxtonAPI.navigate(FauxtonAPI.urls('allDocs', 'app', databaseName, ''));
  }).catch(err => {
    FauxtonAPI.addNotification({
      msg: 'Failed to delete your document. Reason: ' + err.message,
      type: 'error',
      clear: true
    });
  });
}

function showCloneDocModal () {
  FauxtonAPI.dispatch({ type: ActionTypes.SHOW_CLONE_DOC_MODAL });
}

function hideCloneDocModal () {
  FauxtonAPI.dispatch({ type: ActionTypes.HIDE_CLONE_DOC_MODAL });
}

function cloneDoc (database, doc, newId) {

  hideCloneDocModal();

  doc.copy(newId).then(() => {
    FauxtonAPI.navigate('/database/' + database.safeID() + '/' + encodeURIComponent(newId), { trigger: true });

    FauxtonAPI.addNotification({
      msg: 'Document has been duplicated.'
    });

  }, (error) => {
    const errorMsg = `Could not duplicate document, reason: ${error.responseText}.`;
    FauxtonAPI.addNotification({
      msg: errorMsg,
      type: 'error'
    });
  });

}

function showUploadModal () {
  FauxtonAPI.dispatch({ type: ActionTypes.SHOW_UPLOAD_MODAL });
}

function hideUploadModal () {
  FauxtonAPI.dispatch({ type: ActionTypes.HIDE_UPLOAD_MODAL });
}

function uploadAttachment (params) {
  if (params.files.length === 0) {
    FauxtonAPI.dispatch({
      type: ActionTypes.FILE_UPLOAD_ERROR,
      options: {
        error: 'Please select a file to be uploaded.'
      }
    });
    return;
  }
  FauxtonAPI.dispatch({ type: ActionTypes.START_FILE_UPLOAD });

  const query = '?rev=' + params.rev;
  const db = params.doc.getDatabase().safeID();
  const docId = params.doc.safeID();
  const file = params.files[0];
  const url = FauxtonAPI.urls('document', 'attachment', db, docId, encodeURIComponent(file.name), query);

  const onProgress = (evt) => {
    if (evt.lengthComputable) {
      const percentComplete = evt.loaded / evt.total * 100;
      FauxtonAPI.dispatch({
        type: ActionTypes.SET_FILE_UPLOAD_PERCENTAGE,
        options: {
          percent: percentComplete
        }
      });
    }
  };
  const onSuccess = (doc) => {
    // re-initialize the document editor. Only announce it's been updated when
    initDocEditor({
      doc: doc,
      onLoaded: () => {
        FauxtonAPI.dispatch({ type: ActionTypes.FILE_UPLOAD_SUCCESS });
        FauxtonAPI.addNotification({
          msg: 'Document saved successfully.',
          type: 'success',
          clear: true
        });
      }
    });
  };
  const onError = (msg) => {
    FauxtonAPI.dispatch({
      type: ActionTypes.FILE_UPLOAD_ERROR,
      options: {
        error: msg
      }
    });
  };
  const httpRequest = new XMLHttpRequest();
  currentUploadHttpRequest = httpRequest;
  httpRequest.withCredentials = true;
  if (httpRequest.upload) {
    httpRequest.upload.onprogress = onProgress;
  }
  httpRequest.onloadend = () => {
    currentUploadHttpRequest = undefined;
  };
  httpRequest.onerror = () => {
    onError('Error uploading file');
  };
  httpRequest.onload = (e) => {
    if (httpRequest.status >= 200 && httpRequest.status < 300) {
      onSuccess(params.doc);
    } else {
      let errorMsg = 'Error uploading file. ';
      if (e.responseText) {
        try {
          const json = JSON.parse(e.responseText);
          if (json.error) {
            errorMsg += 'Reason: ' + (json.reason || json.error);
          }
        } catch (err) {
          //ignore parsing error
        }
      }
      onError(errorMsg);
    }
  };
  httpRequest.open('PUT', url);
  httpRequest.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  httpRequest.setRequestHeader('Content-Type', file.type || `application/octet-stream`);
  httpRequest.setRequestHeader('Accept', 'application/json');
  httpRequest.send(file);
}

function cancelUpload () {
  if (currentUploadHttpRequest) {
    currentUploadHttpRequest.abort();
  }
}

function resetUploadModal () {
  FauxtonAPI.dispatch({ type: ActionTypes.RESET_UPLOAD_MODAL });
}


// helpers

function errorNotification (msg) {
  FauxtonAPI.addNotification({
    msg: msg,
    type: 'error',
    clear: true
  });
}

export default {
  initDocEditor: initDocEditor,
  saveDoc: saveDoc,

  // clone doc
  showCloneDocModal: showCloneDocModal,
  hideCloneDocModal: hideCloneDocModal,
  cloneDoc: cloneDoc,

  // delete doc
  showDeleteDocModal: showDeleteDocModal,
  hideDeleteDocModal: hideDeleteDocModal,
  deleteDoc: deleteDoc,

  // upload modal
  showUploadModal: showUploadModal,
  hideUploadModal: hideUploadModal,
  uploadAttachment: uploadAttachment,
  cancelUpload: cancelUpload,
  resetUploadModal: resetUploadModal
};
