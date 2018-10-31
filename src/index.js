import fs from 'fs';
import { get as getRequest } from 'request';
import { parser as xmlParser } from 'sax';

export default class XML2JSON {
  /**
   * Parse a XML file that is located on a remote server.
   * @param {string} url - URL of XML file.
   * @param {function} callback - Callback function that will be called after it done processing
   *  XML file.
   * @param {boolean} followRedirect - Indicate whether we want to follow HTTP redirects or not.
   * @param {number} maxRedirects - Maximum number of HTTP redirects we want to follow.
   * @param {string} encoding - Response encoding.
   * @param {number} timeout - Maximum time in milliseconds that we want to wait for server
   *  response.
   */
  static parseFromUrl(url, callback, followRedirect = true, maxRedirects = 10, encoding = 'UTF8', timeout = 10000) {
    getRequest({
      uri: url,
      method: 'GET',
      followRedirect,
      maxRedirects,
      encoding,
      timeout,
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        XML2JSON.parse(body, callback);
      } else if (error) {
        throw Error(`An error occurred: ${error}`);
      } else if (response.statusCode !== 200) {
        throw Error(`An HTTP error occurred with status code: ${response.statusCode}`);
      }
    });
  }

  /**
   * Parse a XML file that is located on local file system.
   * @param {string} filePath - XML file path.
   * @param {function} callback - Callback function that will be called after it done processing
   *  XML file.
   */
  static parseFromFile(filePath, callback) {
    fs.readFile(filePath, { encoding: 'utf-8' }, (error, data) => {
      if (!error) {
        XML2JSON.parse(data, callback);
      } else {
        throw Error(`An error occurred: ${error}`);
      }
    });
  }

  /**
   * Parse a XML text string to a JSON object.
   * @param {string} xmlSource - XML text string.
   * @param {function} callback - Callback function that will be called after it done processing
   *  XML file.
   */
  static parse(xmlSource, callback) {
    const elementsStack = [];
    const jsonObj = {};
    let cdata = '';
    const parser = xmlParser(false, {
      lowercase: true,
      position: false,
      trim: true,
    });
    parser.onerror = (error) => {
      console.log(`error: ${error}`);// TODO: It should be handeled not just by displaying on the console.
      parser.resume();
    };
    parser.onopentag = (tag) => {
      const tagName = tag.name;
      const tagAttributes = tag.attributes;
      if (Object.getOwnPropertyNames(jsonObj).length !== 0) {
        // If object isn't empty.
        // We retrive the parent element from elements stack.
        const parentElement = elementsStack.pop();
        if (tagName in parentElement) {
          // If an element with same name already exist in the parent element. It means we have
          // multiple elements of same type.
          if (Array.isArray(parentElement[tag.name])) {
            // If that element is an array
            // We will add the new element to that array.
            parentElement[tagName].push({ name: tagName, attr: tagAttributes });
            // Then we add parent element and last element of array to elements stack.
            elementsStack.push(parentElement);
            elementsStack.push(parentElement[tagName][parentElement[tagName].length - 1]);
          } else {
            // If that element isn't an array
            // We will save that element in a temporary variable.
            const elementTmp = parentElement[tagName];
            delete parentElement[tagName];
            // Then we create an array for that element.
            parentElement[tagName] = [];
            // After that those elements will be added to newly created array.
            parentElement[tagName].push(elementTmp);
            parentElement[tagName].push({ name: tagName, attr: tagAttributes });
            // At last we add parent element and last element of array to elements stack.
            elementsStack.push(parentElement);
            elementsStack.push(parentElement[tagName][parentElement[tagName].length - 1]);
          }
        } else {
          // If element doesn't exist in the parent element.
          // It will be added to the parent element.
          parentElement[tagName] = { name: tagName, attr: tagAttributes };
          // Then parent element and current element will be added to elements stack.
          elementsStack.push(parentElement);
          elementsStack.push(parentElement[tagName]);
        }
      } else {
        // If object is empty.
        // We will add this element to the object.
        jsonObj[tagName] = { name: tagName, attr: tagAttributes };
        // Then we add that element into the elements stack.
        elementsStack.push(jsonObj[tagName]);
      }
    };
    parser.ontext = (text) => {
      const element = elementsStack.pop();
      element.innerText = text;
      elementsStack.push(element);
    };
    parser.onopencdata = () => {
      cdata = '';
    };
    parser.oncdata = (text) => {
      cdata += text;
    };
    parser.onclosecdata = () => {
      const element = elementsStack.pop();
      element.innerText = cdata;
      elementsStack.push(element);
      cdata = '';
    };
    parser.onclosetag = () => {
      // By every closed tag we will delete the last item of elements stack.
      elementsStack.pop();
    };
    parser.onend = () => {
      callback(jsonObj);
    };
    parser.write(xmlSource).close();
  }

  static getElementAttr(element, attr) {
    if (attr in element.attr) {
      return element.attr[attr];
    }
    return null;
  }

  static getElementText(element) {
    let elementText = null;
    if ('innerText' in element) {
      elementText = element.innerText;
    } else if ('text' in element.attr) {
      const { text } = element.attr;
      elementText = text;
    }
    return elementText;
  }
}
