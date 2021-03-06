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

import FauxtonAPI from "../../core/api";
import Helpers from "../../helpers";
import { deleteRequest, put } from "../../core/ajax";

var Config = FauxtonAPI.addon();

Config.OptionModel = Backbone.Model.extend({
  documentation: FauxtonAPI.constants.DOC_URLS.CONFIG,

  url () {
    if (!this.get('node')) {
      throw new Error('no node set');
    }
    const endpointUrl = '/_node/' + this.get('node') + '/_config/' +
      this.get('sectionName') + '/' + encodeURIComponent(this.get('optionName'));
    return Helpers.getServerUrl(endpointUrl);
  },

  isNew () { return false; },

  sync (method, model) {
    let operation;
    if (method === 'delete') {
      operation = deleteRequest(
        model.url()
      );
    } else {
      operation = put(
        model.url(),
        model.get('value')
      );
    }

    return operation.then((res) => {
      if (res.error) {
        throw new Error(res.reason || res.error);
      }
      return res;
    });
  }
});

Config.ConfigModel = Backbone.Model.extend({
  documentation: FauxtonAPI.constants.DOC_URLS.CONFIG,

  url () {
    if (!this.get('node')) {
      throw new Error('no node set');
    }
    return Helpers.getServerUrl('/_node/' + this.get('node') + '/_config');
  },

  parse (resp) {
    return { sections: resp };
  }
});

export default Config;
